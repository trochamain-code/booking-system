"use server";

import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "./db";
import { bookings, users, resources, companies } from "./schema";
import { getCompanyBySlug, getAvailability } from "./booking-data";
import { sendCustomerConfirmation, sendOwnerNotification, sendCustomerCancellation, sendOwnerCancellation } from "./email";
import { rateLimit, clientIp } from "./rate-limit";
import { hasPgCode, PG_UNIQUE_VIOLATION, PG_EXCLUSION_VIOLATION } from "./pg-error";
import {
  cleanText,
  isValidEmail,
  isDateStr,
  MAX_NAME_LEN,
  MAX_EMAIL_LEN,
  MAX_PHONE_LEN,
  MAX_PARTY_SIZE,
} from "./validation";

// The unique index and the no_overlap_confirmed exclusion constraint guard the
// "one confirmed booking per resource-time" invariant. A violation of either means
// the slot was taken between our availability re-check and this insert.
function isSlotConflict(err: unknown): boolean {
  return hasPgCode(err, PG_UNIQUE_VIOLATION, PG_EXCLUSION_VIOLATION);
}

export async function createBooking(formData: FormData): Promise<void> {
  const ip = await clientIp();
  const limit = rateLimit(`book:ip:${ip}`, 20, 60_000);
  if (!limit.ok) redirect(`/embed/${String(formData.get("slug") ?? "")}?error=rate`);

  const slug = String(formData.get("slug") ?? "");
  const date = String(formData.get("date") ?? "");
  const startAtIso = String(formData.get("startAt") ?? "");
  const partySizeRaw = parseInt(String(formData.get("partySize") ?? ""), 10);
  const customerName = cleanText(formData.get("customerName"), MAX_NAME_LEN);
  const email = cleanText(formData.get("email"), MAX_EMAIL_LEN).toLowerCase();
  const phone = cleanText(formData.get("phone"), MAX_PHONE_LEN) || null;

  const partySize = partySizeRaw;
  const bookHref = `/embed/${slug}/book?date=${date}&party=${partySize}&startAt=${encodeURIComponent(startAtIso)}`;

  const company = await getCompanyBySlug(slug);
  if (!company) redirect(`/embed/${slug}`);

  const validParty = Number.isInteger(partySize) && partySize >= 1 && partySize <= MAX_PARTY_SIZE;
  if (!customerName || !isValidEmail(email) || !validParty || !isDateStr(date) || !startAtIso) {
    redirect(`${bookHref}&error=invalid`);
  }

  // Re-check availability at write time: the engine re-derives the free resource
  // (never trust the client's) and drops past/taken slots. A slot that isn't in
  // this fresh list is gone — redirect the customer back to pick another.
  const slots = await getAvailability(company, date, partySize);
  const slot = slots.find((s) => s.startAt === startAtIso);
  if (!slot) redirect(`/embed/${slug}?date=${date}&party=${partySize}&taken=1`);

  const token = crypto.randomBytes(24).toString("base64url");
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
    // The DB no-overlap/unique constraint is the source of truth under concurrency:
    // a conflict means someone grabbed this resource-time first. Any OTHER error is
    // a real failure and must not be silently reported as "slot taken".
    if (isSlotConflict(err)) {
      redirect(`/embed/${slug}?date=${date}&party=${partySize}&taken=1`);
    }
    throw err;
  }

  const [resource] = await db
    .select({ name: resources.name })
    .from(resources)
    .where(eq(resources.id, slot.resourceId))
    .limit(1);

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
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
    resourceName: resource?.name ?? "Sin especificar",
    cancelUrl,
  });

  const owners = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.companyId, company.id))
    .limit(1);

  if (owners.length > 0) {
    await sendOwnerNotification({
      ownerEmail: owners[0].email,
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
      resourceName: resource?.name ?? "Sin especificar",
      cancelUrl,
    });
  }

  redirect(`/embed/${slug}/confirmed?token=${token}`);
}

export async function cancelBooking(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const ip = await clientIp();
  // Tokens are unguessable, but throttle so the endpoint can't be hammered.
  const limit = rateLimit(`cancel:ip:${ip}`, 30, 60_000);
  if (!limit.ok || !token) {
    redirect(`/cancel/${token}?done=1`);
  }

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

  await db.update(bookings).set({ status: "cancelled" }).where(eq(bookings.token, token));

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
    .where(eq(users.companyId, booking.companyId))
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
