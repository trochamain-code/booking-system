"use server";
import { bookingLanguage } from "./booking-locale";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "./db";
import { bookings, users, resources, companies } from "./schema";
import { cancelBookingWithRefund } from "./cancel-booking-with-refund";
import { sendCustomerCancellation, sendOwnerCancellation } from "./email";
import { rateLimit, clientIp } from "./rate-limit";

// Booking creation lives in stripe-actions.ts (createBookingCheckout), which
// handles both the free path and the Stripe Checkout path.

export async function cancelBooking(formData: FormData): Promise<void> {
  const lang = bookingLanguage(formData.get("lang"));
  const token = String(formData.get("token") ?? "");
  if (!token) redirect("/");

  const ip = await clientIp();
  // Tokens are unguessable, but throttle so the endpoint can't be hammered.
  // A throttled request must NOT pretend the booking was cancelled.
  const limit = rateLimit(`cancel:ip:${ip}`, 30, 60_000);
  if (!limit.ok) redirect(`/cancel/${token}?error=rate&lang=${lang}`);

  const [booking] = await db
    .select({
      language: bookings.language,
      id: bookings.id,
      customerName: bookings.customerName,
      email: bookings.email,
      partySize: bookings.partySize,
      startAt: bookings.startAt,
      createdAt: bookings.createdAt,
      status: bookings.status,
      stripePaymentIntentId: bookings.stripePaymentIntentId,
      amountCents: bookings.amountCents,
      companyName: companies.name,
      companyId: companies.id,
      stripeSecretKey: companies.stripeSecretKey,
      timezone: companies.timezone,
      logoUrl: companies.logoUrl,
      primaryColor: companies.primaryColor,
      senderName: companies.senderName,
      contactInfo: companies.contactInfo,
      resourceName: resources.name,
    })
    .from(bookings)
    .innerJoin(companies, eq(bookings.companyId, companies.id))
    .innerJoin(resources, eq(bookings.resourceId, resources.id))
    .where(eq(bookings.token, token))
    .limit(1);

  if (!booking || booking.status === "cancelled") {
    redirect(`/cancel/${token}?done=1&lang=${lang}`);
  }

  let result;
  try {
    result = await cancelBookingWithRefund(booking.id, booking.companyId);
  } catch (err) {
    console.error("Booking cancellation/refund failed:", err);
    redirect(`/cancel/${token}?error=refund&lang=${lang}`);
  }
  if (!result.changed) redirect(`/cancel/${token}?done=1&lang=${lang}`);

  if (booking.email) await sendCustomerCancellation({
    language: bookingLanguage(booking.language),
    refundCents: result.refundCents,
    to: booking.email,
    customerName: booking.customerName,
    companyName: booking.companyName,
    senderName: booking.senderName || booking.companyName,
    logoUrl: booking.logoUrl,
    primaryColor: booking.primaryColor,
    contactInfo: booking.contactInfo,
    timezone: booking.timezone,
    startAt: booking.startAt,
    partySize: booking.partySize,
  });

  const [notifRow] = await db
    .select({ notificationEmail: companies.notificationEmail })
    .from(companies)
    .where(eq(companies.id, booking.companyId))
    .limit(1);
  let notifyTo = notifRow?.notificationEmail ?? undefined;
  if (!notifyTo) {
    const owners = await db
      .select({ email: users.email })
      .from(users)
      .where(and(eq(users.companyId, booking.companyId), eq(users.role, "owner")))
      .limit(1);
    notifyTo = owners[0]?.email;
  }

  if (notifyTo) {
    await sendOwnerCancellation({
      ownerEmail: notifyTo,
      customerName: booking.customerName,
      customerEmail: booking.email,
      companyName: booking.companyName,
      senderName: booking.senderName || booking.companyName,
      logoUrl: booking.logoUrl,
      primaryColor: booking.primaryColor,
      contactInfo: booking.contactInfo,
      timezone: booking.timezone,
      startAt: booking.startAt,
      partySize: booking.partySize,
      resourceName: booking.resourceName,
    });
  }

  redirect(`/cancel/${token}?done=1&lang=${lang}`);
}
