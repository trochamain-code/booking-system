import { and, eq, gte, lt } from "drizzle-orm";
import { db } from "./db";
import { companies, resources, openingHours, closures, bookings } from "./schema";
import { availableSlots, dayRangeUtc, type Slot } from "./availability";
import { MAX_DURATION_MIN } from "./validation";
import type { Company } from "./schema";

export async function getCompanyBySlug(slug: string): Promise<Company | undefined> {
  const [company] = await db.select().from(companies).where(eq(companies.slug, slug)).limit(1);
  return company;
}

export async function getBookingByToken(token: string) {
  const [row] = await db
    .select({
      status: bookings.status,
      startAt: bookings.startAt,
      partySize: bookings.partySize,
      customerName: bookings.customerName,
      companyName: companies.name,
      timezone: companies.timezone,
      slug: companies.slug,
      primaryColor: companies.primaryColor,
      logoUrl: companies.logoUrl,
      welcomeText: companies.welcomeText,
    })
    .from(bookings)
    .innerJoin(companies, eq(bookings.companyId, companies.id))
    .where(eq(bookings.token, token))
    .limit(1);
  return row;
}

export async function getAvailability(
  company: Company,
  date: string,
  partySize: number,
): Promise<Slot[]> {
  const { start, end } = dayRangeUtc(date, company.timezone);
  // Widen the lower bound by the max possible duration so a long booking that
  // started before midnight but overlaps today's early slots is still fetched.
  const overlapStart = new Date(start.getTime() - MAX_DURATION_MIN * 60_000);
  const [res, hrs, cls, bks] = await Promise.all([
    db.select().from(resources).where(eq(resources.companyId, company.id)),
    db.select().from(openingHours).where(eq(openingHours.companyId, company.id)),
    db.select().from(closures).where(eq(closures.companyId, company.id)),
    db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.companyId, company.id),
          eq(bookings.status, "confirmed"),
          gte(bookings.startAt, overlapStart),
          lt(bookings.startAt, end),
        ),
      ),
  ]);

  return availableSlots({
    date,
    partySize,
    timezone: company.timezone,
    slotIntervalMin: company.slotIntervalMin,
    durationMin: company.defaultDurationMin,
    resources: res.map((r) => ({ id: r.id, capacity: r.capacity, active: r.active })),
    hours: hrs.map((h) => ({ dayOfWeek: h.dayOfWeek, openTime: h.openTime, closeTime: h.closeTime })),
    closures: cls.map((c) => c.date),
    bookings: bks.map((b) => ({ resourceId: b.resourceId, startAt: b.startAt, durationMin: b.durationMin })),
    nowMs: Date.now(),
  });
}
