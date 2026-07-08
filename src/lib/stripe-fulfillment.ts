import type Stripe from "stripe";
import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { bookings, users, resources, companies, type Company } from "./schema";
import { sendCustomerConfirmation, sendOwnerNotification } from "./email";
import { hasPgCode, PG_UNIQUE_VIOLATION, PG_EXCLUSION_VIOLATION } from "./pg-error";

export type BookingView = {
  customerName: string;
  companyName: string;
  startAt: Date;
  partySize: number;
  resourceName: string;
  timezone: string;
  status: "confirmed" | "cancelled";
  logoUrl: string | null;
  primaryColor: string;
  welcomeText: string | null;
};

export type FulfillResult =
  | { ok: true; booking: BookingView }
  | { ok: false; error: "not_paid" | "bad_metadata" | "slot_taken" | "not_found"; refunded?: boolean };

function isSlotConflict(err: unknown): boolean {
  return hasPgCode(err, PG_UNIQUE_VIOLATION, PG_EXCLUSION_VIOLATION);
}

export async function fetchBookingView(token: string): Promise<BookingView | undefined> {
  const [booking] = await db
    .select({
      customerName: bookings.customerName,
      startAt: bookings.startAt,
      partySize: bookings.partySize,
      status: bookings.status,
      resourceName: resources.name,
      companyName: companies.name,
      timezone: companies.timezone,
      logoUrl: companies.logoUrl,
      primaryColor: companies.primaryColor,
      welcomeText: companies.welcomeText,
    })
    .from(bookings)
    .innerJoin(resources, eq(bookings.resourceId, resources.id))
    .innerJoin(companies, eq(bookings.companyId, companies.id))
    .where(eq(bookings.token, token))
    .limit(1);
  return booking;
}

export async function ownerEmail(companyId: string): Promise<string | undefined> {
  const owners = await db
    .select({ email: users.email })
    .from(users)
    .where(and(eq(users.companyId, companyId), eq(users.role, "owner")))
    .limit(1);
  return owners[0]?.email;
}

/**
 * Create the booking a paid Checkout session represents, driven entirely by the
 * session metadata written in createBookingCheckout. Idempotent: the metadata
 * token is unique on bookings, so the webhook and the confirmed-page flow can
 * both run for the same session and exactly one booking results. If the slot
 * was taken while the customer paid, the payment is refunded automatically.
 */
export async function fulfillCheckoutSession(
  stripe: Stripe,
  session: Stripe.Checkout.Session,
  company: Company,
): Promise<FulfillResult> {
  if (session.payment_status !== "paid") return { ok: false, error: "not_paid" };

  const meta = session.metadata;
  if (!meta?.token || meta.companyId !== company.id) return { ok: false, error: "bad_metadata" };
  if (!meta.resourceId || !meta.startAt || !meta.customerName || !meta.email) {
    return { ok: false, error: "bad_metadata" };
  }
  const token = meta.token;

  const existing = await fetchBookingView(token);
  if (existing) return { ok: true, booking: existing };

  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;

  // Insert directly and let the DB unique/exclusion constraints arbitrate. The
  // customer already paid for this exact slot, so re-running the availability
  // engine here would wrongly reject slots that started while they were in
  // Stripe Checkout (and needs the company-local date, which we no longer have).
  try {
    await db.insert(bookings).values({
      companyId: meta.companyId,
      resourceId: meta.resourceId,
      customerName: meta.customerName,
      email: meta.email,
      phone: meta.phone || null,
      partySize: parseInt(meta.partySize ?? "1", 10),
      startAt: new Date(meta.startAt),
      durationMin: parseInt(meta.durationMin ?? "90", 10),
      token,
      stripeSessionId: session.id,
      stripePaymentIntentId: paymentIntentId,
      amountCents: session.amount_total,
    });
  } catch (err) {
    if (!isSlotConflict(err)) throw err;
    // Either a concurrent fulfillment (webhook vs confirmed page) inserted the
    // same token, or the slot was genuinely taken while the customer was paying.
    const race = await fetchBookingView(token);
    if (race) return { ok: true, booking: race };

    // Slot gone: refund automatically so the customer is never charged for a
    // booking that doesn't exist.
    let refunded = false;
    if (paymentIntentId) {
      try {
        await stripe.refunds.create({ payment_intent: paymentIntentId });
        refunded = true;
      } catch (refundErr) {
        console.error("stripe refund failed:", refundErr);
      }
    }
    return { ok: false, error: "slot_taken", refunded };
  }

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const cancelUrl = `${appUrl}/cancel/${token}`;

  const [resource] = await db
    .select({ name: resources.name })
    .from(resources)
    .where(eq(resources.id, meta.resourceId))
    .limit(1);

  await sendCustomerConfirmation({
    to: meta.email,
    customerName: meta.customerName,
    companyName: company.name,
    senderName: company.senderName || company.name,
    logoUrl: company.logoUrl,
    primaryColor: company.primaryColor,
    contactInfo: company.contactInfo,
    timezone: company.timezone,
    startAt: new Date(meta.startAt),
    partySize: parseInt(meta.partySize ?? "1", 10),
    resourceName: resource?.name ?? "Sin especificar",
    cancelUrl,
  });

  const owner = await ownerEmail(company.id);
  if (owner) {
    await sendOwnerNotification({
      ownerEmail: owner,
      customerName: meta.customerName,
      customerEmail: meta.email,
      customerPhone: meta.phone || null,
      companyName: company.name,
      senderName: company.senderName || company.name,
      logoUrl: company.logoUrl,
      primaryColor: company.primaryColor,
      contactInfo: company.contactInfo,
      timezone: company.timezone,
      startAt: new Date(meta.startAt),
      partySize: parseInt(meta.partySize ?? "1", 10),
      resourceName: resource?.name ?? "Sin especificar",
      cancelUrl,
    });
  }

  const booking = await fetchBookingView(token);
  if (!booking) return { ok: false, error: "not_found" };
  return { ok: true, booking };
}
