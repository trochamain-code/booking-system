import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { bookings, cancellationPolicies, companies, resources } from "./schema";
import { cancelBookingWithRefund } from "./cancel-booking-with-refund";
import { computeRefundPercent } from "./cancellation-policy";

// Run only against an explicitly supplied disposable database with migrations applied.
test("cancellation transactions preserve refund quotes, failures and concurrent requests", {
  skip: !process.env.BOOKING_TEST_DATABASE_URL,
}, async () => {
  process.env.DATABASE_URL = process.env.BOOKING_TEST_DATABASE_URL;
  const [company] = await db.insert(companies).values({ slug: `test-${randomUUID()}`, name: "Test" }).returning();
  try {
    const [resource] = await db.insert(resources).values({ companyId: company.id, name: "Test", capacity: 100 }).returning();
    const makeBooking = async (paid: boolean) => {
      const [booking] = await db.insert(bookings).values({
        companyId: company.id, resourceId: resource.id, customerName: "Test Customer",
        email: "test@example.com", partySize: 1, token: randomUUID(), durationMin: 15,
        startAt: new Date(Date.now() + 2 * 86400000), amountCents: paid ? 1000 : null,
        stripePaymentIntentId: paid ? "pi_test" : null,
      }).returning();
      return booking;
    };

    const free = await makeBooking(false);
    const concurrent = await Promise.all([
      cancelBookingWithRefund(free.id, company.id), cancelBookingWithRefund(free.id, company.id),
    ]);
    assert.equal(concurrent.filter((r) => r.changed).length, 1);
    assert.equal(concurrent[0].refundCents, 0);

    // No policy means no refund, including for paid bookings.
    const noRefund = await makeBooking(true);
    assert.deepEqual(await cancelBookingWithRefund(noRefund.id, company.id), { changed: true, refundCents: 0 });

    const [policy] = await db.insert(cancellationPolicies).values({
      companyId: company.id, ruleType: "before_event", thresholdMinutes: 60, refundPercent: 50,
    }).returning();
    const paid = await makeBooking(true);
    assert.equal(await computeRefundPercent(paid, company.id), 50);
    // Missing credentials must not silently cancel a booking that is owed money.
    await assert.rejects(cancelBookingWithRefund(paid.id, company.id), /configuration missing/);
    const [afterFailure] = await db.select().from(bookings).where(eq(bookings.id, paid.id));
    assert.equal(afterFailure.status, "confirmed");
    assert.equal(afterFailure.cancellationRefundCents, 500);
    assert.equal(afterFailure.stripeRefundId, null);

    await db.update(cancellationPolicies).set({ refundPercent: 0 }).where(eq(cancellationPolicies.id, policy.id));
    await assert.rejects(cancelBookingWithRefund(paid.id, company.id), /configuration missing/);
    const [afterRetry] = await db.select().from(bookings).where(eq(bookings.id, paid.id));
    assert.equal(afterRetry.cancellationRefundCents, 500);
    assert.equal(afterRetry.status, "confirmed");

    // A recovered Stripe refund can complete cancellation without another charge operation.
    await db.update(bookings).set({ stripeRefundId: "re_recovered" }).where(eq(bookings.id, paid.id));
    assert.deepEqual(await cancelBookingWithRefund(paid.id, company.id), { changed: true, refundCents: 500 });
    assert.deepEqual(await cancelBookingWithRefund(paid.id, company.id), { changed: false, refundCents: 500 });
    await assert.rejects(cancelBookingWithRefund(paid.id, randomUUID()), /not found/);
  } finally {
    await db.delete(companies).where(eq(companies.id, company.id));
    const pg = (globalThis as unknown as { _pg?: { end(): Promise<void> } })._pg;
    await pg?.end();
  }
});
