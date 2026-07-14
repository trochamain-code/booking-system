import { and, eq } from "drizzle-orm";
import { requireApiKey } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { bookings, companies, resources } from "@/lib/schema";
import { getBookingByToken } from "@/lib/booking-data";

// View or cancel a single booking by its token (the same unguessable token the
// web confirmation/cancel pages use). Lets the WhatsApp bot show "your
// reservation" and cancel it — keeping web and WhatsApp on one agenda.
//
//   GET    /api/public/bookings/<token>   -> booking view
//   DELETE /api/public/bookings/<token>   -> cancel (confirmed -> cancelled)
//
// A "reschedule" over WhatsApp = DELETE the old token + POST a new booking.
// Paid (Stripe) bookings are NOT cancelled here: refunds are money-movement and
// must go through the existing /cancel web flow. The API returns that URL.
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ token: string }> },
): Promise<Response> {
  const denied = requireApiKey(req);
  if (denied) return denied;

  const { token } = await ctx.params;
  const row = await getBookingByToken(token);
  if (!row) return Response.json({ error: "not_found" }, { status: 404 });

  return Response.json({
    status: row.status,
    startAt: row.startAt,
    partySize: row.partySize,
    customerName: row.customerName,
    email: row.email,
    companyName: row.companyName,
    slug: row.slug,
    timezone: row.timezone,
  });
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ token: string }> },
): Promise<Response> {
  const denied = requireApiKey(req);
  if (denied) return denied;

  const { token } = await ctx.params;
  if (!token) return Response.json({ error: "missing_token" }, { status: 400 });

  const [booking] = await db
    .select({
      id: bookings.id,
      status: bookings.status,
      stripePaymentIntentId: bookings.stripePaymentIntentId,
      companyName: companies.name,
      resourceName: resources.name,
    })
    .from(bookings)
    .innerJoin(companies, eq(bookings.companyId, companies.id))
    .innerJoin(resources, eq(bookings.resourceId, resources.id))
    .where(eq(bookings.token, token))
    .limit(1);

  if (!booking) return Response.json({ error: "not_found" }, { status: 404 });
  if (booking.status === "cancelled") {
    return Response.json({ status: "cancelled", alreadyCancelled: true });
  }

  // Money rule: a paid booking's cancellation may owe a refund. Refunds are
  // money movement and stay in the web /cancel flow (Stripe-aware). Don't
  // silently cancel a paid booking here.
  if (booking.stripePaymentIntentId) {
    const appUrl = process.env.APP_URL ?? "https://booking.host-ia.online";
    return Response.json(
      {
        error: "paid_booking",
        message: "paid bookings are cancelled (with refund) from the web page",
        cancelUrl: `${appUrl}/cancel/${token}`,
      },
      { status: 409 },
    );
  }

  // Atomic: the status predicate makes a concurrent double-cancel flip 0 rows.
  const cancelled = await db
    .update(bookings)
    .set({ status: "cancelled" })
    .where(and(eq(bookings.token, token), eq(bookings.status, "confirmed")))
    .returning({ id: bookings.id });

  if (cancelled.length === 0) {
    return Response.json({ status: "cancelled", alreadyCancelled: true });
  }
  return Response.json({ status: "cancelled" });
}
