import { eq } from "drizzle-orm";
import { db } from "../src/lib/db";
import { companies, users, resources, openingHours } from "../src/lib/schema";
import { hashPassword } from "../src/lib/password";

const SLUG = "demo-bistro";

async function main() {
  // Fresh slate: cascade-delete any existing demo company.
  await db.delete(companies).where(eq(companies.slug, SLUG));

  const [company] = await db
    .insert(companies)
    .values({
      slug: SLUG,
      name: "Bistró Demo",
      timezone: "Europe/Madrid",
      primaryColor: "#b91c1c",
      slotIntervalMin: 30,
      defaultDurationMin: 15,
    })
    .returning();

  await db.insert(users).values({
    email: "owner@demo.com",
    passwordHash: await hashPassword("password123"),
    role: "owner",
    companyId: company.id,
  });

  await db.insert(resources).values([
    { companyId: company.id, name: "Mesa 1", capacity: 2 },
    { companyId: company.id, name: "Mesa 2", capacity: 4 },
    { companyId: company.id, name: "Mesa 3", capacity: 6 },
  ]);

  // Abierto todos los días de 13:00 a 16:00 y de 20:00 a 23:30.
  await db.insert(openingHours).values(
    Array.from({ length: 7 }, (_, dow) => [
      { companyId: company.id, dayOfWeek: dow, openTime: "13:00", closeTime: "16:00" },
      { companyId: company.id, dayOfWeek: dow, openTime: "20:00", closeTime: "23:30" },
    ]).flat(),
  );

  console.log(`Creado "${company.name}"`);
  console.log(`  Propietario: owner@demo.com / password123`);
  console.log(`  Widget:      http://localhost:3000/embed/${SLUG}`);
  process.exit(0);
}

main();
