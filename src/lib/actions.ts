"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "./db";
import { users } from "./schema";
import { verifyPassword } from "./password";
import { createSession, destroySession } from "./session";
import { rateLimit, clientIp } from "./rate-limit";
import { isValidEmail } from "./validation";

// A real-format hash for a password nobody has. When the email doesn't exist we
// still run a full scrypt verify against this so response time doesn't reveal
// whether an account exists (user-enumeration timing oracle).
const DUMMY_HASH =
  "7bec01e21da8861cfd7afe72c2e2ebdc:cf80914d25d0f5a3cc53b2dba8c6c41a03c501c0d43dec9873ac8a00e3212e01a573f1ca64ade5117bac83eb1ba28b893260eade4a25c0b41d7d869fe0dba22a";

export async function login(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  // Throttle brute force: cap attempts per IP and per targeted account.
  const ip = await clientIp();
  const byIp = rateLimit(`login:ip:${ip}`, 10, 60_000);
  const byEmail = rateLimit(`login:email:${email}`, 5, 60_000);
  if (!byIp.ok || !byEmail.ok) redirect("/login?error=rate");

  if (!email || !password || !isValidEmail(email)) redirect("/login?error=1");

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) redirect("/login?error=1");

  await createSession({ userId: user.id, role: user.role, companyId: user.companyId });
  redirect(user.role === "super_admin" ? "/admin" : "/dashboard");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}
