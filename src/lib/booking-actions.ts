"use server";

import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "./db";
import { bookings } from "./schema";
import { getCompanyBySlug, getAvailability } from "./booking-data";
import { sendBookingConfirmation } from "./email";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function createBooking(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "");
  const date = String(formData.get("date") ?? "");
  const startAtIso = String(formData.get("startAt") ?? "");
  const partySize = parseInt(String(formData.get("partySize") ?? ""), 10);
  const customerName = String(formData.get("customerName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim() || null;

  const bookHref = `/embed/${slug}/book?date=${date}&party=${partySize}&startAt=${encodeURIComponent(startAtIso)}`;

  const company = await getCompanyBySlug(slug);
  if (!company) redirect(`/embed/${slug}`);
  if (!customerName || !EMAIL_RE.test(email) || !(partySize >= 1) || !startAtIso) {
    redirect(`${bookHref}&error=invalid`);
  }

  // Re-check at write time; use the freshly assigned resource rather than trusting the client.
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
      startAt: new Date(startAtIso),
      durationMin: company.defaultDurationMin,
      token,
    });
  } catch {
    // uniq_confirmed_slot race — someone grabbed this slot first.
    redirect(`/embed/${slug}?date=${date}&party=${partySize}&taken=1`);
  }

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  await sendBookingConfirmation({
    to: email,
    customerName,
    companyName: company.name,
    timezone: company.timezone,
    startAt: new Date(startAtIso),
    partySize,
    cancelUrl: `${appUrl}/cancel/${token}`,
  });

  redirect(`/embed/${slug}/confirmed?token=${token}`);
}

export async function cancelBooking(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  if (token) {
    await db.update(bookings).set({ status: "cancelled" }).where(eq(bookings.token, token));
  }
  redirect(`/cancel/${token}?done=1`);
}
