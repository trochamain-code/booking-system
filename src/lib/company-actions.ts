"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "./db";
import { resources, openingHours, closures, bookings, companies } from "./schema";
import { requireRole } from "./session";

async function currentCompanyId(): Promise<string> {
  const session = await requireRole("owner", "staff");
  if (!session.companyId) redirect("/login");
  return session.companyId;
}

function toInt(v: FormDataEntryValue | null, min: number, fallback: number): number {
  const n = parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) && n >= min ? n : fallback;
}

// --- Resources ---

export async function addResource(formData: FormData): Promise<void> {
  const companyId = await currentCompanyId();
  const name = String(formData.get("name") ?? "").trim();
  const capacity = toInt(formData.get("capacity"), 1, 1);
  if (!name) redirect("/dashboard/resources?error=1");
  await db.insert(resources).values({ companyId, name, capacity });
  revalidatePath("/dashboard/resources");
}

export async function updateResource(formData: FormData): Promise<void> {
  const companyId = await currentCompanyId();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const capacity = toInt(formData.get("capacity"), 1, 1);
  const active = formData.get("active") === "on";
  if (!id || !name) redirect("/dashboard/resources?error=1");
  // Scoped by companyId so one company cannot edit another's resource.
  await db
    .update(resources)
    .set({ name, capacity, active })
    .where(and(eq(resources.id, id), eq(resources.companyId, companyId)));
  revalidatePath("/dashboard/resources");
}

// --- Opening hours ---

export async function addOpeningHour(formData: FormData): Promise<void> {
  const companyId = await currentCompanyId();
  const dayOfWeek = toInt(formData.get("dayOfWeek"), 0, -1);
  const openTime = String(formData.get("openTime") ?? "");
  const closeTime = String(formData.get("closeTime") ?? "");
  const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (dayOfWeek < 0 || dayOfWeek > 6 || !timeRe.test(openTime) || !timeRe.test(closeTime) || openTime >= closeTime) {
    redirect("/dashboard/hours?error=1");
  }
  await db.insert(openingHours).values({ companyId, dayOfWeek, openTime, closeTime });
  revalidatePath("/dashboard/hours");
}

export async function deleteOpeningHour(formData: FormData): Promise<void> {
  const companyId = await currentCompanyId();
  const id = String(formData.get("id") ?? "");
  await db.delete(openingHours).where(and(eq(openingHours.id, id), eq(openingHours.companyId, companyId)));
  revalidatePath("/dashboard/hours");
}

// --- Closures ---

export async function addClosure(formData: FormData): Promise<void> {
  const companyId = await currentCompanyId();
  const date = String(formData.get("date") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) redirect("/dashboard/hours?error=1");
  await db.insert(closures).values({ companyId, date, reason });
  revalidatePath("/dashboard/hours");
}

export async function deleteClosure(formData: FormData): Promise<void> {
  const companyId = await currentCompanyId();
  const id = String(formData.get("id") ?? "");
  await db.delete(closures).where(and(eq(closures.id, id), eq(closures.companyId, companyId)));
  revalidatePath("/dashboard/hours");
}

// --- Bookings (staff side) ---

export async function staffCancelBooking(formData: FormData): Promise<void> {
  const companyId = await currentCompanyId();
  const id = String(formData.get("id") ?? "");
  // Scoped by companyId so staff can only cancel their own company's bookings.
  await db
    .update(bookings)
    .set({ status: "cancelled" })
    .where(and(eq(bookings.id, id), eq(bookings.companyId, companyId)));
  revalidatePath("/dashboard/bookings");
}

// --- Branding ---

export async function updateBranding(formData: FormData): Promise<void> {
  const companyId = await currentCompanyId();
  const logoUrl = String(formData.get("logoUrl") ?? "").trim() || null;
  const primaryColor = String(formData.get("primaryColor") ?? "").trim() || "#111827";
  await db
    .update(companies)
    .set({ logoUrl, primaryColor })
    .where(eq(companies.id, companyId));
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
}
