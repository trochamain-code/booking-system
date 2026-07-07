"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "./db";
import { users } from "./schema";
import { verifyPassword } from "./password";
import { createSession, destroySession } from "./session";

export async function login(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) redirect("/login?error=1");

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user || !verifyPassword(password, user.passwordHash)) redirect("/login?error=1");

  await createSession({ userId: user.id, role: user.role, companyId: user.companyId });
  redirect(user.role === "super_admin" ? "/admin" : "/dashboard");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}
