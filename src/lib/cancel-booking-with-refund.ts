import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { bookings, companies } from "./schema";
import { computeRefundPercent } from "./cancellation-policy";
import { createStripeClient } from "./stripe";
import { requestCancellationRefund } from "./cancellation-refund";

export async function cancelBookingWithRefund(id: string, companyId: string) {
  const predicate = and(eq(bookings.id, id), eq(bookings.companyId, companyId));

  // Commit the policy amount independently of the external payment request.
  // A timeout or a later policy change must not change the retry's amount.
  await db.transaction(async (tx) => {
    const [booking] = await tx.select().from(bookings).where(predicate).for("update");
    if (!booking) throw new Error("Booking not found");
    if (booking.status === "cancelled" || booking.cancellationRefundCents !== null) return;
    const percent = await computeRefundPercent(booking, companyId);
    const amount = booking.stripePaymentIntentId
      ? Math.round((booking.amountCents ?? 0) * percent / 100) : 0;
    await tx.update(bookings).set({ cancellationRefundCents: amount }).where(predicate);
  });

  return db.transaction(async (tx) => {
    const [booking] = await tx.select().from(bookings).where(predicate).for("update");
    if (!booking) throw new Error("Booking not found");
    if (booking.status === "cancelled") return { changed: false, refundCents: booking.cancellationRefundCents };
    const amount = booking.cancellationRefundCents ?? 0;
    let stripeRefundId = booking.stripeRefundId;
    if (amount > 0 && !stripeRefundId) {
      const [company] = await tx.select({ key: companies.stripeSecretKey }).from(companies)
        .where(eq(companies.id, companyId));
      if (!company?.key || !booking.stripePaymentIntentId) throw new Error("Refund payment configuration missing");
      stripeRefundId = await requestCancellationRefund(
        createStripeClient(company.key), booking.id, booking.stripePaymentIntentId, amount,
      );
    }
    // If Stripe fails, this transaction rolls back and the booking stays active.
    await tx.update(bookings).set({ status: "cancelled", stripeRefundId }).where(predicate);
    return { changed: true, refundCents: amount };
  });
}
