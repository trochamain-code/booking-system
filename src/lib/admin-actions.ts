"use server";

import { and, eq, not } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "./db";
import { companies, users, resources, openingHours, closures, bookings } from "./schema";
import { hashPassword } from "./password";
import { requireRole } from "./session";
import { slugify } from "./slug";
import { sendCustomerCancellation, sendOwnerCancellation } from "./email";
import {
  cleanText,
  isValidEmail,
  isValidTimeZone,
  isHexColor,
  isHttpUrl,
  isDateStr,
  isTimeStr,
  isUuid,
  parseBoundedInt,
  MAX_NAME_LEN,
  MAX_EMAIL_LEN,
  MAX_REASON_LEN,
  MAX_CAPACITY,
} from "./validation";

export async function createCompany(formData: FormData): Promise<void> {
  await requireRole("super_admin");

  const name = cleanText(formData.get("name"), MAX_NAME_LEN);
  const timezone = String(formData.get("timezone") ?? "").trim() || "UTC";
  const email = cleanText(formData.get("email"), 254).toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!name || !isValidEmail(email) || password.length < 8 || password.length > 200) {
    redirect("/admin?error=invalid");
  }
  if (!isValidTimeZone(timezone)) redirect("/admin?error=timezone");

  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existingUser) redirect("/admin?error=email");

  const base = slugify(name);
  let slug = base;
  for (let n = 2; ; n++) {
    const [taken] = await db
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.slug, slug))
      .limit(1);
    if (!taken) break;
    slug = `${base}-${n}`;
  }

  const passwordHash = await hashPassword(password);
  await db.transaction(async (tx) => {
    const [company] = await tx
      .insert(companies)
      .values({ name, slug, timezone })
      .returning({ id: companies.id });
    await tx.insert(users).values({
      email,
      passwordHash,
      role: "owner",
      companyId: company.id,
    });
  });

  revalidatePath("/admin");
  redirect("/admin?created=1");
}

export async function updateCompany(formData: FormData): Promise<void> {
  await requireRole("super_admin");

  const id = String(formData.get("id") ?? "");
  const name = cleanText(formData.get("name"), MAX_NAME_LEN);
  const slug = String(formData.get("slug") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "").trim();
  const rawColor = String(formData.get("primaryColor") ?? "").trim();
  const rawLogo = String(formData.get("logoUrl") ?? "").trim();
  const rawWelcome = String(formData.get("welcomeText") ?? "").trim();
  const rawSender = String(formData.get("senderName") ?? "").trim();
  const rawContact = String(formData.get("contactInfo") ?? "").trim();

  if (!name || !slug || !isValidTimeZone(timezone)) redirect("/admin?error=invalid");

  const primaryColor = isHexColor(rawColor) ? rawColor : "#111827";
  const logoUrl = rawLogo && isHttpUrl(rawLogo) ? rawLogo : null;
  const welcomeText = rawWelcome || null;
  const senderName = rawSender || "";
  const contactInfo = rawContact || null;

  const [conflict] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(and(eq(companies.slug, slug), not(eq(companies.id, id))))
    .limit(1);
  if (conflict) redirect("/admin?error=slug_taken");

  await db
    .update(companies)
    .set({ name, slug, timezone, primaryColor, logoUrl, welcomeText, senderName, contactInfo })
    .where(eq(companies.id, id));

  revalidatePath("/admin");
  redirect("/admin?updated=1");
}

export async function deleteCompany(formData: FormData): Promise<void> {
  await requireRole("super_admin");
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/admin?error=invalid");
  await db.delete(companies).where(eq(companies.id, id));
  revalidatePath("/admin");
  redirect("/admin?deleted=1");
}

// --- Resources (any company) ---

export async function adminAddResource(formData: FormData): Promise<void> {
  await requireRole("super_admin");
  const companyId = String(formData.get("companyId") ?? "");
  const name = cleanText(formData.get("name"), MAX_NAME_LEN);
  const capacity = parseBoundedInt(formData.get("capacity"), 1, MAX_CAPACITY, 1);
  if (!companyId || !name) redirect(`/admin/companies/${companyId}?error=1`);
  await db.insert(resources).values({ companyId, name, capacity });
  revalidatePath(`/admin/companies/${companyId}`);
}

export async function adminUpdateResource(formData: FormData): Promise<void> {
  await requireRole("super_admin");
  const companyId = String(formData.get("companyId") ?? "");
  const id = String(formData.get("id") ?? "");
  const name = cleanText(formData.get("name"), MAX_NAME_LEN);
  const capacity = parseBoundedInt(formData.get("capacity"), 1, MAX_CAPACITY, 1);
  const active = formData.get("active") === "on";
  if (!companyId || !isUuid(id) || !name) redirect(`/admin/companies/${companyId}?error=1`);
  await db
    .update(resources)
    .set({ name, capacity, active })
    .where(and(eq(resources.id, id), eq(resources.companyId, companyId)));
  revalidatePath(`/admin/companies/${companyId}`);
}

// --- Opening hours (any company) ---

export async function adminAddOpeningHour(formData: FormData): Promise<void> {
  await requireRole("super_admin");
  const companyId = String(formData.get("companyId") ?? "");
  const dayOfWeek = parseBoundedInt(formData.get("dayOfWeek"), 0, 6, -1);
  const openTime = String(formData.get("openTime") ?? "");
  const closeTime = String(formData.get("closeTime") ?? "");
  if (!companyId || dayOfWeek < 0 || dayOfWeek > 6 || !isTimeStr(openTime) || !isTimeStr(closeTime) || openTime >= closeTime) {
    redirect(`/admin/companies/${companyId}?error=1`);
  }
  await db.insert(openingHours).values({ companyId, dayOfWeek, openTime, closeTime });
  revalidatePath(`/admin/companies/${companyId}`);
}

export async function adminDeleteOpeningHour(formData: FormData): Promise<void> {
  await requireRole("super_admin");
  const companyId = String(formData.get("companyId") ?? "");
  const id = String(formData.get("id") ?? "");
  if (!companyId || !isUuid(id)) redirect(`/admin/companies/${companyId}?error=1`);
  await db.delete(openingHours).where(and(eq(openingHours.id, id), eq(openingHours.companyId, companyId)));
  revalidatePath(`/admin/companies/${companyId}`);
}

// --- Closures (any company) ---

export async function adminAddClosure(formData: FormData): Promise<void> {
  await requireRole("super_admin");
  const companyId = String(formData.get("companyId") ?? "");
  const date = String(formData.get("date") ?? "");
  const reason = cleanText(formData.get("reason"), MAX_REASON_LEN) || null;
  if (!companyId || !isDateStr(date)) redirect(`/admin/companies/${companyId}?error=1`);
  await db.insert(closures).values({ companyId, date, reason }).onConflictDoNothing();
  revalidatePath(`/admin/companies/${companyId}`);
}

export async function adminDeleteClosure(formData: FormData): Promise<void> {
  await requireRole("super_admin");
  const companyId = String(formData.get("companyId") ?? "");
  const id = String(formData.get("id") ?? "");
  if (!companyId || !isUuid(id)) redirect(`/admin/companies/${companyId}?error=1`);
  await db.delete(closures).where(and(eq(closures.id, id), eq(closures.companyId, companyId)));
  revalidatePath(`/admin/companies/${companyId}`);
}

// --- Bookings (any company) ---

export async function adminCancelBooking(formData: FormData): Promise<void> {
  await requireRole("super_admin");
  const companyId = String(formData.get("companyId") ?? "");
  const id = String(formData.get("id") ?? "");
  if (!companyId || !isUuid(id)) redirect(`/admin/companies/${companyId}?error=1`);

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

  if (!booking) redirect(`/admin/companies/${companyId}?error=1`);

  await db
    .update(bookings)
    .set({ status: "cancelled" })
    .where(and(eq(bookings.id, id), eq(bookings.companyId, companyId)));

  revalidatePath(`/admin/companies/${companyId}`);

  const [company] = await db
    .select({ name: companies.name, timezone: companies.timezone, logoUrl: companies.logoUrl, primaryColor: companies.primaryColor, senderName: companies.senderName, contactInfo: companies.contactInfo })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);

  if (!company) return;

  const owners = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.companyId, companyId))
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

// --- Owner ---

export async function adminUpdateOwner(formData: FormData): Promise<void> {
  await requireRole("super_admin");
  const companyId = String(formData.get("companyId") ?? "");
  const email = cleanText(formData.get("email"), MAX_EMAIL_LEN).toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!companyId || !isValidEmail(email)) redirect(`/admin/companies/${companyId}?error=1`);

  const owner = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.companyId, companyId), eq(users.role, "owner")))
    .limit(1);
  if (owner.length === 0) redirect(`/admin/companies/${companyId}?error=1`);

  // Check email isn't taken by another user
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, email), not(eq(users.id, owner[0].id))))
    .limit(1);
  if (existing) redirect(`/admin/companies/${companyId}?error=email`);

  const updates: Record<string, string> = { email };
  if (password.length >= 8) {
    updates.passwordHash = await hashPassword(password);
  }

  await db.update(users).set(updates).where(eq(users.id, owner[0].id));
  revalidatePath(`/admin/companies/${companyId}`);
}
