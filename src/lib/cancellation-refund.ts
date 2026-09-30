import type Stripe from "stripe";

// The booking lock serializes callers. Metadata lets a retry recover even after
// Stripe's idempotency key retention window or a lost database commit.
export async function requestCancellationRefund(
  stripe: Pick<Stripe, "refunds">,
  bookingId: string,
  paymentIntent: string,
  amount: number,
): Promise<string> {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("Invalid refund amount");
  let refund: Stripe.Refund | undefined;
  for await (const existing of stripe.refunds.list({ payment_intent: paymentIntent, limit: 100 })) {
    if (existing.metadata?.booking_cancellation === bookingId) {
      refund = existing;
      break;
    }
  }
  refund ??= await stripe.refunds.create({
    payment_intent: paymentIntent,
    amount,
    metadata: { booking_cancellation: bookingId },
  }, { idempotencyKey: `booking-cancellation:${bookingId}` });
  if (refund.amount !== amount || !["succeeded", "pending"].includes(refund.status ?? "")) {
    throw new Error("Refund needs attention in Stripe");
  }
  return refund.id;
}
