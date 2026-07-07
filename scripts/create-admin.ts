import { eq } from "drizzle-orm";
import { db } from "../src/lib/db";
import { users } from "../src/lib/schema";
import { hashPassword } from "../src/lib/password";

// Create (or reset the password of) a super-admin.
// Credentials come from env so they never live in the repo:
//   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=... pnpm exec tsx scripts/create-admin.ts
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;

async function main() {
  if (!email || !password) {
    console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD env vars.");
    process.exit(1);
  }
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    await db
      .update(users)
      .set({ passwordHash: await hashPassword(password), role: "super_admin" })
      .where(eq(users.email, email));
    console.log(`Updated super-admin password -> ${email}`);
  } else {
    await db
      .insert(users)
      .values({ email, passwordHash: await hashPassword(password), role: "super_admin" });
    console.log(`Created super-admin -> ${email}`);
  }
  process.exit(0);
}

main();
