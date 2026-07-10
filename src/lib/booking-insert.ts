import { and, eq, lt, sql } from "drizzle-orm";
import { db } from "./db";
import { bookings, resources } from "./schema";

/** The party no longer fits in the resource's pooled capacity (aforo). */
export class CapacityConflictError extends Error {
  constructor() {
    super("resource capacity exceeded for this slot");
    this.name = "CapacityConflictError";
  }
}

export type NewBooking = {
  companyId: string;
  resourceId: string;
  customerName: string;
  email: string | null;
  phone: string | null;
  comments: string | null;
  partySize: number;
  startAt: Date;
  durationMin: number;
  token: string;
  source?: "widget" | "manual";
  stripeSessionId?: string | null;
  stripePaymentIntentId?: string | null;
  amountCents?: number | null;
};

/**
 * Insert a confirmed booking, enforcing the pooled-capacity rule: the sum of
 * party sizes of confirmed bookings overlapping the slot must stay within the
 * resource's capacity. The resource row is locked FOR UPDATE so concurrent
 * inserts on the same resource serialize and cannot oversell the aforo.
 *
 * Throws CapacityConflictError when the party no longer fits; token-uniqueness
 * violations (idempotent Stripe fulfillment) still surface as pg errors.
 */
export async function insertBookingWithCapacityCheck(values: NewBooking): Promise<void> {
  await db.transaction(async (tx) => {
    const [resource] = await tx
      .select({ capacity: resources.capacity, active: resources.active })
      .from(resources)
      .where(eq(resources.id, values.resourceId))
      .for("update");
    if (!resource || !resource.active) throw new CapacityConflictError();

    const end = new Date(values.startAt.getTime() + values.durationMin * 60_000);
    const [{ booked }] = await tx
      .select({ booked: sql<string>`coalesce(sum(${bookings.partySize}), 0)` })
      .from(bookings)
      .where(
        and(
          eq(bookings.resourceId, values.resourceId),
          eq(bookings.status, "confirmed"),
          lt(bookings.startAt, end),
          // ISO string, not Date: raw sql params skip drizzle's column mapping.
          sql`${bookings.startAt} + make_interval(mins => ${bookings.durationMin}) > ${values.startAt.toISOString()}`,
        ),
      );

    if (Number(booked) + values.partySize > resource.capacity) throw new CapacityConflictError();

    await tx.insert(bookings).values(values);
  });
}
