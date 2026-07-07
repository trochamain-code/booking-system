"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "./db";
import { companies, users } from "./schema";
import { hashPassword } from "./password";
import { requireRole } from "./session";
import { slugify } from "./slug";

export async function createCompany(formData: FormData): Promise<void> {
  await requireRole("super_admin");

  const name = String(formData.get("name") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "").trim() || "UTC";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!name || !email || password.length < 8) redirect("/admin?error=invalid");

  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existingUser) redirect("/admin?error=email");

  // Find a free, URL-safe slug.
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

  await db.transaction(async (tx) => {
    const [company] = await tx
      .insert(companies)
      .values({ name, slug, timezone })
      .returning({ id: companies.id });
    await tx.insert(users).values({
      email,
      passwordHash: hashPassword(password),
      role: "owner",
      companyId: company.id,
    });
  });

  revalidatePath("/admin");
  redirect("/admin?created=1");
}
