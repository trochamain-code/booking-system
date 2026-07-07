import { eq } from "drizzle-orm";
import { db } from "../src/lib/db";
import { users } from "../src/lib/schema";
import { hashPassword } from "../src/lib/password";

const email = "admin@example.com";
const password = "admin1234";

async function main() {
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    console.log(`super-admin already exists: ${email}`);
  } else {
    await db
      .insert(users)
      .values({ email, passwordHash: hashPassword(password), role: "super_admin" });
    console.log(`Seeded super-admin -> ${email} / ${password}`);
  }
  process.exit(0);
}

main();
