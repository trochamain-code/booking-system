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
import { computeRefundPercent, refundBooking } from "./cancellation-policy";
import { createCompanyWebhook, deleteCompanyWebhook } from "./stripe";
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
  parsePriceEuros,
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

  if (!isUuid(id) || !name || !slug || !isValidTimeZone(timezone)) redirect("/admin?error=invalid");

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

  // Relative paths only — this comes from a hidden form field, so an absolute
  // URL here would be an open redirect.
  const rawRedirect = String(formData.get("redirectTo") ?? "/admin");
  const redirectTo = rawRedirect.startsWith("/") && !rawRedirect.startsWith("//") ? rawRedirect : "/admin";

  revalidatePath("/admin");
  revalidatePath(`/admin/companies/${id}`);
  redirect(`${redirectTo}?updated=1`);
}

// Separate from updateCompany so the general company forms (which don't carry
// Stripe fields) can never blank out saved keys, and vice versa.
export async function updateCompanyStripe(formData: FormData): Promise<void> {
  await requireRole("super_admin");

  const id = String(formData.get("id") ?? "");
  if (!isUuid(id)) redirect("/admin?error=invalid");
  const back = `/admin/companies/${id}`;

  const stripeEnabled = formData.get("stripeEnabled") === "on";
  const clearKeys = formData.get("stripeClear") === "on";
  const rawSecret = String(formData.get("stripeSecretKey") ?? "").trim();
  const rawPub = String(formData.get("stripePublishableKey") ?? "").trim();

  // sk_ = standard secret, rk_ = restricted key. Reject anything else early so a
  // pasted publishable key (or garbage) fails here instead of at checkout time.
  if (rawSecret && !/^(sk|rk)_(live|test)_/.test(rawSecret)) redirect(`${back}?error=stripe_secret`);
  if (rawPub && !/^pk_(live|test)_/.test(rawPub)) redirect(`${back}?error=stripe_pub`);

  const [row] = await db
    .select({
      name: companies.name,
      stripeSecretKey: companies.stripeSecretKey,
      stripeWebhookSecret: companies.stripeWebhookSecret,
      stripeWebhookEndpointId: companies.stripeWebhookEndpointId,
    })
    .from(companies)
    .where(eq(companies.id, id))
    .limit(1);
  if (!row) redirect("/admin?error=invalid");

  const updates: Partial<typeof companies.$inferInsert> = { stripeEnabled };

  if (clearKeys) {
    if (row.stripeSecretKey && row.stripeWebhookEndpointId) {
      await deleteCompanyWebhook(row.stripeSecretKey, row.stripeWebhookEndpointId);
    }
    updates.stripeSecretKey = null;
    updates.stripePublishableKey = null;
    updates.stripeWebhookSecret = null;
    updates.stripeWebhookEndpointId = null;
    updates.stripeEnabled = false;
    await db.update(companies).set(updates).where(eq(companies.id, id));
    revalidatePath(back);
    redirect(`${back}?updated=1`);
  }

  // Empty inputs keep the stored keys — the secret is never echoed back into
  // the form, so an untouched field must not overwrite it.
  if (rawSecret) updates.stripeSecretKey = rawSecret;
  if (rawPub) updates.stripePublishableKey = rawPub;

  const effectiveSecret = rawSecret || row.stripeSecretKey;
  if (stripeEnabled && !effectiveSecret) redirect(`${back}?error=stripe_secret`);

  // (Re)provision the fulfillment webhook in the tenant's Stripe account when
  // the key changes or none exists yet, so paid bookings are created even if
  // the customer never returns from Checkout.
  const keyChanged = Boolean(rawSecret) && rawSecret !== row.stripeSecretKey;
  let webhookFailed = false;
  if (effectiveSecret && (keyChanged || !row.stripeWebhookSecret)) {
    if (keyChanged && row.stripeSecretKey && row.stripeWebhookEndpointId) {
      await deleteCompanyWebhook(row.stripeSecretKey, row.stripeWebhookEndpointId);
      updates.stripeWebhookSecret = null;
      updates.stripeWebhookEndpointId = null;
    }
    try {
      const { endpointId, secret } = await createCompanyWebhook(effectiveSecret, id, row.name);
      updates.stripeWebhookSecret = secret;
      updates.stripeWebhookEndpointId = endpointId;
    } catch (err) {
      // Keys still get saved — payments keep working via the redirect flow.
      console.error("stripe webhook provisioning failed:", err);
      webhookFailed = true;
    }
  }

  await db.update(companies).set(updates).where(eq(companies.id, id));

  revalidatePath(back);
  redirect(webhookFailed ? `${back}?error=stripe_webhook` : `${back}?updated=1`);
}

export async function deleteCompany(formData: FormData): Promise<void> {
  await requireRole("super_admin");
  const id = String(formData.get("id") ?? "");
  if (!isUuid(id)) redirect("/admin?error=invalid");
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
  const priceCents = parsePriceEuros(formData.get("priceEuros"));
  if (!isUuid(companyId) || !name || priceCents === undefined) {
    redirect(`/admin/companies/${companyId}?error=1`);
  }
  await db.insert(resources).values({ companyId, name, capacity, priceCents });
  revalidatePath(`/admin/companies/${companyId}`);
}

export async function adminUpdateResource(formData: FormData): Promise<void> {
  await requireRole("super_admin");
  const companyId = String(formData.get("companyId") ?? "");
  const id = String(formData.get("id") ?? "");
  const name = cleanText(formData.get("name"), MAX_NAME_LEN);
  const capacity = parseBoundedInt(formData.get("capacity"), 1, MAX_CAPACITY, 1);
  const active = formData.get("active") === "on";
  const priceCents = parsePriceEuros(formData.get("priceEuros"));
  if (!companyId || !isUuid(id) || !name || priceCents === undefined) {
    redirect(`/admin/companies/${companyId}?error=1`);
  }
  await db
    .update(resources)
    .set({ name, capacity, active, priceCents })
    .where(and(eq(resources.id, id), eq(resources.companyId, companyId)));
  revalidatePath(`/admin/companies/${companyId}`);
}

export async function adminDeleteResource(formData: FormData): Promise<void> {
  await requireRole("super_admin");
  const companyId = String(formData.get("companyId") ?? "");
  const id = String(formData.get("id") ?? "");
  if (!isUuid(companyId) || !isUuid(id)) {
    redirect(`/admin/companies/${companyId}?error=1`);
  }
  await db
    .delete(resources)
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
      createdAt: bookings.createdAt,
      stripePaymentIntentId: bookings.stripePaymentIntentId,
      amountCents: bookings.amountCents,
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
    .select({ name: companies.name, timezone: companies.timezone, logoUrl: companies.logoUrl, primaryColor: companies.primaryColor, senderName: companies.senderName, contactInfo: companies.contactInfo, stripeSecretKey: companies.stripeSecretKey })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);

  const refundPercent = await computeRefundPercent(booking, companyId);
  if (refundPercent > 0 && booking.stripePaymentIntentId && company.stripeSecretKey && booking.amountCents) {
    await refundBooking(booking.stripePaymentIntentId, booking.amountCents, refundPercent, company.stripeSecretKey);
  }

  if (!company) return;

  const owners = await db
    .select({ email: users.email })
    .from(users)
    .where(and(eq(users.companyId, companyId), eq(users.role, "owner")))
    .limit(1);

  if (booking.email) await sendCustomerCancellation({
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

  // A 1–7 char password must be an explicit error — silently updating only the
  // email would leave the admin believing the password was changed.
  if (password && (password.length < 8 || password.length > 200)) {
    redirect(`/admin/companies/${companyId}?error=password`);
  }
  const updates: Record<string, string> = { email };
  if (password) {
    updates.passwordHash = await hashPassword(password);
  }

  await db.update(users).set(updates).where(eq(users.id, owner[0].id));
  revalidatePath(`/admin/companies/${companyId}`);
  redirect(`/admin/companies/${companyId}?updated=1`);
}
