import { and, eq, gte, lt } from "drizzle-orm";
import { db } from "./db";
import { companies, resources, openingHours, closures, bookings } from "./schema";
import { availableSlots, dayRangeUtc, weekday, type Slot } from "./availability";
import { MAX_DURATION_MIN } from "./validation";
import type { Company } from "./schema";

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

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
      email: bookings.email,
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
  // includePast lets staff record a manual booking for a slot that already
  // started (e.g. logging tonight's phone reservation after opening).
  opts: { includePast?: boolean } = {},
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
    resources: res.map((r) => ({ id: r.id, capacity: r.capacity, active: r.active, priceCents: r.priceCents })),
    hours: hrs.map((h) => ({ dayOfWeek: h.dayOfWeek, openTime: h.openTime, closeTime: h.closeTime })),
    closures: cls.map((c) => c.date),
    bookings: bks.map((b) => ({ resourceId: b.resourceId, startAt: b.startAt, durationMin: b.durationMin, partySize: b.partySize })),
    nowMs: opts.includePast ? undefined : Date.now(),
  });
}

export async function getAvailableDates(
  company: Company,
  partySize: number,
  daysAhead: number = 60,
): Promise<Set<string>> {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: company.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const lastDate = shiftDate(today, daysAhead);
  const { start: rangeStart } = dayRangeUtc(today, company.timezone);
  const { end: rangeEnd } = dayRangeUtc(lastDate, company.timezone);
  const overlapStart = new Date(rangeStart.getTime() - MAX_DURATION_MIN * 60_000);

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
          lt(bookings.startAt, rangeEnd),
        ),
      ),
  ]);

  const resourcesMapped = res.map((r) => ({ id: r.id, capacity: r.capacity, active: r.active, priceCents: r.priceCents }));
  const hoursMapped = hrs.map((h) => ({ dayOfWeek: h.dayOfWeek, openTime: h.openTime, closeTime: h.closeTime }));
  const allClosures = cls.map((c) => c.date);
  const allBookings = bks.map((b) => ({ resourceId: b.resourceId, startAt: b.startAt, durationMin: b.durationMin, partySize: b.partySize }));
  const nowMs = Date.now();

  const available = new Set<string>();

  for (let i = 0; i <= daysAhead; i++) {
    const d = shiftDate(today, i);
    if (allClosures.includes(d)) continue;
    if (!hoursMapped.some((h) => h.dayOfWeek === weekday(d))) continue;

    const { start, end } = dayRangeUtc(d, company.timezone);
    const windowStart = new Date(start.getTime() - MAX_DURATION_MIN * 60_000);
    const dayBookings = allBookings.filter(
      (b) => b.startAt.getTime() >= windowStart.getTime() && b.startAt.getTime() < end.getTime(),
    );

    const slots = availableSlots({
      date: d,
      partySize,
      timezone: company.timezone,
      slotIntervalMin: company.slotIntervalMin,
      durationMin: company.defaultDurationMin,
      resources: resourcesMapped,
      hours: hoursMapped,
      closures: allClosures,
      bookings: dayBookings,
      nowMs,
    });

    if (slots.length > 0) available.add(d);
  }

  return available;
}
