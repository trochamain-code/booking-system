"use server";

import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "./db";
import { bookings, users, resources, companies } from "./schema";
import { getCompanyBySlug, getAvailability } from "./booking-data";
import { sendCustomerConfirmation, sendOwnerNotification } from "./email";
import { rateLimit, clientIp } from "./rate-limit";
import { hasPgCode, PG_UNIQUE_VIOLATION, PG_EXCLUSION_VIOLATION } from "./pg-error";
import { createStripeClient } from "./stripe";
import {
  cleanText,
  isValidEmail,
  isDateStr,
  MAX_NAME_LEN,
  MAX_EMAIL_LEN,
  MAX_PHONE_LEN,
  MAX_PARTY_SIZE,
} from "./validation";

function isSlotConflict(err: unknown): boolean {
  return hasPgCode(err, PG_UNIQUE_VIOLATION, PG_EXCLUSION_VIOLATION);
}

type BookingView = {
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

export type ConfirmPaymentResult =
  | { ok: true; booking: BookingView }
  | { ok: false; error: "rate" | "invalid_company" | "stripe_error" | "not_paid" | "invalid_token" | "not_found" | "slot_taken"; refunded?: boolean };

async function fetchBookingView(token: string): Promise<BookingView | undefined> {
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

async function ownerEmail(companyId: string): Promise<string | undefined> {
  const owners = await db
    .select({ email: users.email })
    .from(users)
    .where(and(eq(users.companyId, companyId), eq(users.role, "owner")))
    .limit(1);
  return owners[0]?.email;
}

export async function createBookingCheckout(formData: FormData): Promise<void> {
  const ip = await clientIp();
  const limit = rateLimit(`book:ip:${ip}`, 20, 60_000);
  if (!limit.ok) redirect(`/embed/${String(formData.get("slug") ?? "")}?error=rate`);

  const slug = String(formData.get("slug") ?? "");
  const date = String(formData.get("date") ?? "");
  const startAtIso = String(formData.get("startAt") ?? "");
  const partySize = parseInt(String(formData.get("partySize") ?? ""), 10);
  const customerName = cleanText(formData.get("customerName"), MAX_NAME_LEN);
  const email = cleanText(formData.get("email"), MAX_EMAIL_LEN).toLowerCase();
  const phone = cleanText(formData.get("phone"), MAX_PHONE_LEN) || null;

  const bookHref = `/embed/${slug}/book?date=${date}&party=${partySize}&startAt=${encodeURIComponent(startAtIso)}`;

  const company = await getCompanyBySlug(slug);
  if (!company) redirect(`/embed/${slug}`);

  const validParty = Number.isInteger(partySize) && partySize >= 1 && partySize <= MAX_PARTY_SIZE;
  if (!customerName || !isValidEmail(email) || !validParty || !isDateStr(date) || !startAtIso) {
    redirect(`${bookHref}&error=invalid`);
  }

  const slots = await getAvailability(company, date, partySize);
  const slot = slots.find((s) => s.startAt === startAtIso);
  if (!slot) redirect(`/embed/${slug}?date=${date}&party=${partySize}&taken=1`);

  const [resource] = await db
    .select({ name: resources.name, priceCents: resources.priceCents })
    .from(resources)
    .where(eq(resources.id, slot.resourceId))
    .limit(1);
  if (!resource) redirect(bookHref);

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const token = crypto.randomBytes(24).toString("base64url");

  if (!company.stripeEnabled || !resource.priceCents || resource.priceCents < 1) {
    try {
      await db.insert(bookings).values({
        companyId: company.id,
        resourceId: slot.resourceId,
        customerName,
        email,
        phone,
        partySize,
        startAt: new Date(slot.startAt),
        durationMin: company.defaultDurationMin,
        token,
      });
    } catch (err) {
      if (isSlotConflict(err)) {
        redirect(`/embed/${slug}?date=${date}&party=${partySize}&taken=1`);
      }
      throw err;
    }

    const cancelUrl = `${appUrl}/cancel/${token}`;

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

    const owner = await ownerEmail(company.id);
    if (owner) {
      await sendOwnerNotification({
        ownerEmail: owner,
        customerName,
        customerEmail: email,
        customerPhone: phone,
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

    redirect(`/embed/${slug}/confirmed?token=${token}`);
  }

  const stripeSecret = company.stripeSecretKey;
  if (!stripeSecret) redirect(`${bookHref}&error=payment`);

  const stripe = createStripeClient(stripeSecret);
  let sessionUrl: string | null = null;
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: `Reserva: ${resource.name}`,
              description: `${company.name} · ${partySize} personas · ${new Intl.DateTimeFormat("es-ES", { timeZone: company.timezone, dateStyle: "long", timeStyle: "short" }).format(new Date(startAtIso))}`,
            },
            unit_amount: resource.priceCents,
          },
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/embed/${slug}/confirmed?session_id={CHECKOUT_SESSION_ID}&token=${token}`,
      cancel_url: `${appUrl}/embed/${slug}?date=${date}&party=${partySize}`,
      customer_email: email,
      locale: "es",
      // Checkout sessions expire; the booking row is only created after payment in
      // confirmPayment, driven entirely by this metadata (never by client input).
      metadata: {
        slug,
        companyId: company.id,
        resourceId: slot.resourceId,
        startAt: startAtIso,
        partySize: String(partySize),
        customerName,
        email,
        phone: phone ?? "",
        durationMin: String(company.defaultDurationMin),
        token,
      },
    });
    sessionUrl = session.url;
  } catch (err) {
    console.error("stripe checkout create failed:", err);
    sessionUrl = null;
  }

  if (!sessionUrl) redirect(`${bookHref}&error=payment`);
  redirect(sessionUrl);
}

export async function confirmPayment(sessionId: string, token: string, slug: string): Promise<ConfirmPaymentResult> {
  const ip = await clientIp();
  const limit = rateLimit(`confirm:ip:${ip}`, 20, 60_000);
  if (!limit.ok) return { ok: false, error: "rate" };

  const company = await getCompanyBySlug(slug);
  if (!company || !company.stripeSecretKey) return { ok: false, error: "invalid_company" };

  const stripe = createStripeClient(company.stripeSecretKey);
  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch (err) {
    console.error("stripe session retrieve failed:", err);
    return { ok: false, error: "stripe_error" };
  }

  if (session.payment_status !== "paid") return { ok: false, error: "not_paid" };

  const meta = session.metadata;
  // Constant-time compare: the token doubles as proof that whoever loads the
  // confirmed page is the person who started this checkout.
  const metaTokenBuf = Buffer.from(meta?.token ?? "");
  const tokenBuf = Buffer.from(token);
  const tokenMatches =
    metaTokenBuf.length > 0 &&
    metaTokenBuf.length === tokenBuf.length &&
    crypto.timingSafeEqual(metaTokenBuf, tokenBuf);
  if (!meta || !tokenMatches) return { ok: false, error: "invalid_token" };
  if (meta.companyId !== company.id) return { ok: false, error: "invalid_token" };
  if (!meta.resourceId || !meta.startAt || !meta.customerName || !meta.email) {
    return { ok: false, error: "invalid_token" };
  }

  const existing = await fetchBookingView(token);
  if (existing) return { ok: true, booking: existing };

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
    });
  } catch (err) {
    if (!isSlotConflict(err)) throw err;
    // Either a concurrent render of this page inserted the same token, or the
    // slot was genuinely taken while the customer was paying.
    const race = await fetchBookingView(token);
    if (race) return { ok: true, booking: race };

    // Slot gone: refund automatically so the customer is never charged for a
    // booking that doesn't exist.
    let refunded = false;
    const paymentIntent = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
    if (paymentIntent) {
      try {
        await stripe.refunds.create({ payment_intent: paymentIntent });
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
