"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "./db";
import { bookings, users, resources, companies } from "./schema";
import { sendCustomerCancellation, sendOwnerCancellation } from "./email";
import { rateLimit, clientIp } from "./rate-limit";

// Booking creation lives in stripe-actions.ts (createBookingCheckout), which
// handles both the free path and the Stripe Checkout path.

export async function cancelBooking(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  if (!token) redirect("/");

  const ip = await clientIp();
  // Tokens are unguessable, but throttle so the endpoint can't be hammered.
  // A throttled request must NOT pretend the booking was cancelled.
  const limit = rateLimit(`cancel:ip:${ip}`, 30, 60_000);
  if (!limit.ok) redirect(`/cancel/${token}?error=rate`);

  const [booking] = await db
    .select({
      id: bookings.id,
      customerName: bookings.customerName,
      email: bookings.email,
      partySize: bookings.partySize,
      startAt: bookings.startAt,
      status: bookings.status,
      companyName: companies.name,
      companyId: companies.id,
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
    redirect(`/cancel/${token}?done=1`);
  }

  // Status predicate makes the cancel atomic: a concurrent double-submit flips
  // zero rows on the second run, so cancellation emails go out exactly once.
  const cancelled = await db
    .update(bookings)
    .set({ status: "cancelled" })
    .where(and(eq(bookings.token, token), eq(bookings.status, "confirmed")))
    .returning({ id: bookings.id });
  if (cancelled.length === 0) redirect(`/cancel/${token}?done=1`);

  await sendCustomerCancellation({
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

  const owners = await db
    .select({ email: users.email })
    .from(users)
    .where(and(eq(users.companyId, booking.companyId), eq(users.role, "owner")))
    .limit(1);

  if (owners.length > 0) {
    await sendOwnerCancellation({
      ownerEmail: owners[0].email,
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

  redirect(`/cancel/${token}?done=1`);
}
