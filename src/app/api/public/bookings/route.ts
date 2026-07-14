import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { requireApiKey } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { resources } from "@/lib/schema";
import { getCompanyBySlug, getAvailability } from "@/lib/booking-data";
import { insertBookingWithCapacityCheck, CapacityConflictError } from "@/lib/booking-insert";
import { sendCustomerConfirmation, sendOwnerNotification } from "@/lib/email";
import { ownerEmail } from "@/lib/stripe-fulfillment";
import { hasPgCode, PG_UNIQUE_VIOLATION, PG_EXCLUSION_VIOLATION } from "@/lib/pg-error";
import {
  isValidEmail,
  isDateStr,
  MAX_NAME_LEN,
  MAX_EMAIL_LEN,
  MAX_PHONE_LEN,
  MAX_COMMENTS_LEN,
  MAX_PARTY_SIZE,
} from "@/lib/validation";

// Create a booking from an external automation (WhatsApp bot). Writes to the
// SAME agenda as the public widget: reuses getAvailability (slot must be free)
// and insertBookingWithCapacityCheck (atomic aforo/capacity guard), so web and
// WhatsApp can never oversell the same slot.
//
//   POST /api/public/bookings
//   { "slug","date","startAt","partySize","customerName","phone","email?","comments?" }
//     -> 201 { token, startAt, resourceName, status:"confirmed", cancelUrl }
//
// If the company charges online (Stripe), the API does NOT create an unpaid
// booking — it returns 402 with the widget URL so payment happens on the web.
export const dynamic = "force-dynamic";

function clip(v: unknown, max: number): string {
  return String(v ?? "").trim().slice(0, max);
}

export async function POST(req: Request): Promise<Response> {
  const denied = requireApiKey(req);
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const slug = clip(body.slug, 120);
  const date = clip(body.date, 10);
  const startAtIso = clip(body.startAt, 40);
  const partySize = parseInt(String(body.partySize ?? ""), 10);
  const customerName = clip(body.customerName, MAX_NAME_LEN);
  const email = clip(body.email, MAX_EMAIL_LEN).toLowerCase() || null;
  const phone = clip(body.phone, MAX_PHONE_LEN);
  const comments = clip(body.comments, MAX_COMMENTS_LEN) || null;

  if (!slug) return Response.json({ error: "missing_slug" }, { status: 400 });
  const validParty = Number.isInteger(partySize) && partySize >= 1 && partySize <= MAX_PARTY_SIZE;
  if (!customerName || !phone || !validParty || !isDateStr(date) || !startAtIso) {
    return Response.json({ error: "invalid_fields" }, { status: 400 });
  }
  if (email !== null && !isValidEmail(email)) {
    return Response.json({ error: "invalid_email" }, { status: 400 });
  }

  const company = await getCompanyBySlug(slug);
  if (!company) return Response.json({ error: "company_not_found" }, { status: 404 });

  const slots = await getAvailability(company, date, partySize);
  const slot = slots.find((s) => s.startAt === startAtIso);
  if (!slot) return Response.json({ error: "slot_taken", message: "that slot is no longer available" }, { status: 409 });

  const [resource] = await db
    .select({ name: resources.name, priceCents: resources.priceCents })
    .from(resources)
    .where(eq(resources.id, slot.resourceId))
    .limit(1);
  if (!resource) return Response.json({ error: "slot_taken" }, { status: 409 });

  // Paid bookings must go through the web checkout — never create unpaid here.
  if (company.stripeEnabled && resource.priceCents && resource.priceCents >= 1) {
    const appUrl = process.env.APP_URL ?? "https://booking.host-ia.online";
    return Response.json(
      {
        error: "payment_required",
        message: "this company charges online; send the customer to the web widget to pay",
        widgetUrl: `${appUrl}/embed/${company.slug}?date=${date}&party=${partySize}`,
      },
      { status: 402 },
    );
  }

  const token = crypto.randomBytes(24).toString("base64url");
  try {
    await insertBookingWithCapacityCheck({
      companyId: company.id,
      resourceId: slot.resourceId,
      customerName,
      email,
      phone,
      comments,
      partySize,
      startAt: new Date(slot.startAt),
      durationMin: company.defaultDurationMin,
      token,
      source: "manual", // came in over WhatsApp, not the web widget
    });
  } catch (err) {
    if (err instanceof CapacityConflictError || hasPgCode(err, PG_UNIQUE_VIOLATION, PG_EXCLUSION_VIOLATION)) {
      return Response.json({ error: "slot_taken", message: "that slot filled up" }, { status: 409 });
    }
    throw err;
  }

  const appUrl = process.env.APP_URL ?? "https://booking.host-ia.online";
  const cancelUrl = `${appUrl}/cancel/${token}`;

  // Best-effort notifications: mirror the web flow but never fail the booking
  // if email delivery hiccups (the reservation itself already committed).
  try {
    if (email) {
      await sendCustomerConfirmation({
        to: email,
        customerName,
        companyName: company.name,
        senderName: company.senderName || company.name,
        logoUrl: company.logoUrl,
        primaryColor: company.primaryColor,
        contactInfo: company.contactInfo,
        timezone: company.timezone,
        startAt: new Date(slot.startAt),
        partySize,
        resourceName: resource.name,
        cancelUrl,
      });
    }
    const owner = await ownerEmail(company.id);
    if (owner) {
      await sendOwnerNotification({
        ownerEmail: owner,
        customerName,
        customerEmail: email,
        customerPhone: phone,
        customerComments: comments,
        companyName: company.name,
        senderName: company.senderName || company.name,
        logoUrl: company.logoUrl,
        primaryColor: company.primaryColor,
        contactInfo: company.contactInfo,
        timezone: company.timezone,
        startAt: new Date(slot.startAt),
        partySize,
        resourceName: resource.name,
        cancelUrl,
      });
    }
  } catch {
    // swallow: booking is confirmed regardless of email delivery
  }

  return Response.json(
    {
      token,
      status: "confirmed",
      slug: company.slug,
      startAt: slot.startAt,
      partySize,
      resourceName: resource.name,
      customerName,
      cancelUrl,
    },
    { status: 201 },
  );
}
