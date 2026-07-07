"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "./db";
import { resources, openingHours, closures, bookings, companies, users } from "./schema";
import { requireRole } from "./session";
import { sendCustomerCancellation, sendOwnerCancellation } from "./email";
import {
  cleanText,
  isDateStr,
  isHexColor,
  isHttpUrl,
  isTimeStr,
  isUuid,
  parseBoundedInt,
  parsePriceEuros,
  MAX_CAPACITY,
  MAX_NAME_LEN,
  MAX_REASON_LEN,
} from "./validation";

const DEFAULT_COLOR = "#111827";

async function currentCompanyId(): Promise<string> {
  const session = await requireRole("owner", "staff");
  if (!session.companyId) redirect("/login");
  return session.companyId;
}

// --- Resources ---

export async function addResource(formData: FormData): Promise<void> {
  const companyId = await currentCompanyId();
  const name = cleanText(formData.get("name"), MAX_NAME_LEN);
  const capacity = parseBoundedInt(formData.get("capacity"), 1, MAX_CAPACITY, 1);
  const priceCents = parsePriceEuros(formData.get("priceEuros"));
  if (!name || priceCents === undefined) redirect("/dashboard/resources?error=1");
  await db.insert(resources).values({ companyId, name, capacity, priceCents });
  revalidatePath("/dashboard/resources");
}

export async function updateResource(formData: FormData): Promise<void> {
  const companyId = await currentCompanyId();
  const id = String(formData.get("id") ?? "");
  const name = cleanText(formData.get("name"), MAX_NAME_LEN);
  const capacity = parseBoundedInt(formData.get("capacity"), 1, MAX_CAPACITY, 1);
  const active = formData.get("active") === "on";
  const priceCents = parsePriceEuros(formData.get("priceEuros"));
  if (!isUuid(id) || !name || priceCents === undefined) redirect("/dashboard/resources?error=1");
  // Scoped by companyId so one company cannot edit another's resource.
  await db
    .update(resources)
    .set({ name, capacity, active, priceCents })
    .where(and(eq(resources.id, id), eq(resources.companyId, companyId)));
  revalidatePath("/dashboard/resources");
}

// --- Opening hours ---

export async function addOpeningHour(formData: FormData): Promise<void> {
  const companyId = await currentCompanyId();
  const dayOfWeek = parseBoundedInt(formData.get("dayOfWeek"), 0, 6, -1);
  const openTime = String(formData.get("openTime") ?? "");
  const closeTime = String(formData.get("closeTime") ?? "");
  if (dayOfWeek < 0 || dayOfWeek > 6 || !isTimeStr(openTime) || !isTimeStr(closeTime) || openTime >= closeTime) {
    redirect("/dashboard/hours?error=1");
  }
  await db.insert(openingHours).values({ companyId, dayOfWeek, openTime, closeTime });
  revalidatePath("/dashboard/hours");
}

export async function deleteOpeningHour(formData: FormData): Promise<void> {
  const companyId = await currentCompanyId();
  const id = String(formData.get("id") ?? "");
  if (!isUuid(id)) redirect("/dashboard/hours?error=1");
  await db.delete(openingHours).where(and(eq(openingHours.id, id), eq(openingHours.companyId, companyId)));
  revalidatePath("/dashboard/hours");
}

// --- Closures ---

export async function addClosure(formData: FormData): Promise<void> {
  const companyId = await currentCompanyId();
  const date = String(formData.get("date") ?? "");
  const reason = cleanText(formData.get("reason"), MAX_REASON_LEN) || null;
  if (!isDateStr(date)) redirect("/dashboard/hours?error=1");
  // Ignore a duplicate closure for the same day instead of erroring on the
  // (company_id, date) unique constraint.
  await db.insert(closures).values({ companyId, date, reason }).onConflictDoNothing();
  revalidatePath("/dashboard/hours");
}

export async function deleteClosure(formData: FormData): Promise<void> {
  const companyId = await currentCompanyId();
  const id = String(formData.get("id") ?? "");
  if (!isUuid(id)) redirect("/dashboard/hours?error=1");
  await db.delete(closures).where(and(eq(closures.id, id), eq(closures.companyId, companyId)));
  revalidatePath("/dashboard/hours");
}

// --- Bookings (staff side) ---

export async function staffCancelBooking(formData: FormData): Promise<void> {
  const companyId = await currentCompanyId();
  const id = String(formData.get("id") ?? "");
  if (!isUuid(id)) redirect("/dashboard/bookings?error=1");

  const [booking] = await db
    .select({
      token: bookings.token,
      customerName: bookings.customerName,
      email: bookings.email,
      partySize: bookings.partySize,
      startAt: bookings.startAt,
      resourceName: resources.name,
    })
    .from(bookings)
    .innerJoin(resources, eq(bookings.resourceId, resources.id))
    .where(and(eq(bookings.id, id), eq(bookings.companyId, companyId)))
    .limit(1);

  if (!booking) redirect("/dashboard/bookings?error=1");

  await db
    .update(bookings)
    .set({ status: "cancelled" })
    .where(and(eq(bookings.id, id), eq(bookings.companyId, companyId)));

  revalidatePath("/dashboard/bookings");

  const [company] = await db
    .select({ name: companies.name, timezone: companies.timezone, logoUrl: companies.logoUrl, primaryColor: companies.primaryColor, senderName: companies.senderName, contactInfo: companies.contactInfo })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);

  if (!company) return;

  const owners = await db
    .select({ email: users.email })
    .from(users)
    .where(and(eq(users.companyId, companyId), eq(users.role, "owner")))
    .limit(1);

  await sendCustomerCancellation({
    to: booking.email,
    customerName: booking.customerName,
    companyName: company.name,
    senderName: company.senderName || company.name,
    logoUrl: company.logoUrl,
    primaryColor: company.primaryColor,
    contactInfo: company.contactInfo,
    timezone: company.timezone,
    startAt: booking.startAt,
    partySize: booking.partySize,
  });

  if (owners.length > 0) {
    await sendOwnerCancellation({
      ownerEmail: owners[0].email,
      customerName: booking.customerName,
      customerEmail: booking.email,
      companyName: company.name,
      senderName: company.senderName || company.name,
      logoUrl: company.logoUrl,
      primaryColor: company.primaryColor,
      contactInfo: company.contactInfo,
      timezone: company.timezone,
      startAt: booking.startAt,
      partySize: booking.partySize,
      resourceName: booking.resourceName,
    });
  }
}

// --- Branding ---

export async function updateBranding(formData: FormData): Promise<void> {
  const companyId = await currentCompanyId();
  const rawLogo = String(formData.get("logoUrl") ?? "").trim();
  const rawColor = String(formData.get("primaryColor") ?? "").trim();
  const rawWelcome = String(formData.get("welcomeText") ?? "").trim();
  const rawSender = String(formData.get("senderName") ?? "").trim();
  const rawContact = String(formData.get("contactInfo") ?? "").trim();

  const logoUrl = rawLogo && isHttpUrl(rawLogo) ? rawLogo : null;
  const primaryColor = isHexColor(rawColor) ? rawColor : DEFAULT_COLOR;
  const welcomeText = rawWelcome || null;
  const senderName = rawSender || "";
  const contactInfo = rawContact || null;

  if (rawLogo && !logoUrl) redirect("/dashboard/settings?error=logo");
  if (rawColor && primaryColor !== rawColor) redirect("/dashboard/settings?error=color");

  await db
    .update(companies)
    .set({ logoUrl, primaryColor, welcomeText, senderName, contactInfo })
    .where(eq(companies.id, companyId));
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
}
