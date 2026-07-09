"use server";

import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "./db";
import { bookings, resources } from "./schema";
import { getCompanyBySlug, getAvailability } from "./booking-data";
import { sendCustomerConfirmation, sendOwnerNotification } from "./email";
import { rateLimit, clientIp } from "./rate-limit";
import { hasPgCode, PG_UNIQUE_VIOLATION, PG_EXCLUSION_VIOLATION } from "./pg-error";
import { createStripeClient } from "./stripe";
import { fulfillCheckoutSession, ownerEmail, type BookingView } from "./stripe-fulfillment";
import {
  cleanText,
  isValidEmail,
  isDateStr,
  MAX_NAME_LEN,
  MAX_EMAIL_LEN,
  MAX_PHONE_LEN,
  MAX_COMMENTS_LEN,
  MAX_PARTY_SIZE,
} from "./validation";

function isSlotConflict(err: unknown): boolean {
  return hasPgCode(err, PG_UNIQUE_VIOLATION, PG_EXCLUSION_VIOLATION);
}

export type ConfirmPaymentResult =
  | { ok: true; booking: BookingView }
  | { ok: false; error: "rate" | "invalid_company" | "stripe_error" | "not_paid" | "invalid_token" | "not_found" | "slot_taken"; refunded?: boolean };

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
  const comments = cleanText(formData.get("comments"), MAX_COMMENTS_LEN) || null;

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
        comments,
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
            unit_amount: resource.priceCents * partySize,
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
        comments: comments ?? "",
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
  // Stripe Checkout refuses to run inside an iframe, and the widget is usually
  // embedded on the tenant's site. Send the iframe to an interstitial that
  // navigates the TOP window to Checkout instead of redirecting here directly.
  redirect(`/embed/${slug}/pay?to=${encodeURIComponent(sessionUrl)}`);
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

  // Constant-time compare: the token doubles as proof that whoever loads the
  // confirmed page is the person who started this checkout.
  const metaTokenBuf = Buffer.from(session.metadata?.token ?? "");
  const tokenBuf = Buffer.from(token);
  const tokenMatches =
    metaTokenBuf.length > 0 &&
    metaTokenBuf.length === tokenBuf.length &&
    crypto.timingSafeEqual(metaTokenBuf, tokenBuf);
  if (!tokenMatches) return { ok: false, error: "invalid_token" };

  const result = await fulfillCheckoutSession(stripe, session, company);
  if (result.ok) return result;
  if (result.error === "bad_metadata") return { ok: false, error: "invalid_token" };
  return { ok: false, error: result.error, refunded: result.refunded };
}
