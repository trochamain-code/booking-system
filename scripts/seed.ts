import { eq } from "drizzle-orm";
import { db } from "../src/lib/db";
import { users } from "../src/lib/schema";
import { hashPassword } from "../src/lib/password";

// Super-admin seeded at startup. Set ADMIN_EMAIL / ADMIN_PASSWORD (see .env /
// docker-compose) to control it; falls back to a dev default for local use.
const email = process.env.ADMIN_EMAIL ?? "admin@example.com";
const password = process.env.ADMIN_PASSWORD ?? "admin1234";

// Never seed the well-known weak defaults into a production database.
const WEAK_DEFAULTS = new Set(["admin1234", "password", "changeme"]);

async function main() {
  if (process.env.NODE_ENV === "production" && (WEAK_DEFAULTS.has(password) || password.length < 12)) {
    console.error(
      "Refusing to seed a weak super-admin password in production. " +
        "Set ADMIN_PASSWORD to a strong value (12+ chars) in the environment.",
    );
    process.exit(1);
  }
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    console.log(`super-admin already exists: ${email}`);
  } else {
    await db
      .insert(users)
      .values({ email, passwordHash: await hashPassword(password), role: "super_admin" });
    console.log(`Seeded super-admin -> ${email}`);
  }
  process.exit(0);
}

main();
