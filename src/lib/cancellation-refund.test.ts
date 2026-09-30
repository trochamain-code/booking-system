import { test } from "node:test";
import assert from "node:assert/strict";
import type Stripe from "stripe";
import { requestCancellationRefund } from "./cancellation-refund";

function fakeStripe(existing: Partial<Stripe.Refund>[] = [], status = "succeeded") {
  const calls: { params: Stripe.RefundCreateParams; options: Stripe.RequestOptions }[] = [];
  const stripe = { refunds: {
    async *list() { yield* existing; },
    async create(params: Stripe.RefundCreateParams, options: Stripe.RequestOptions) {
      calls.push({ params, options });
      return { id: "re_test", amount: params.amount, status };
    },
  } } as unknown as Pick<Stripe, "refunds">;
  return { stripe, calls };
}

test("refund sends the exact policy amount with a stable idempotency key", async () => {
  const { stripe, calls } = fakeStripe();
  assert.equal(await requestCancellationRefund(stripe, "booking", "pi_test", 250), "re_test");
  assert.deepEqual(calls, [{ params: {
    payment_intent: "pi_test", amount: 250, metadata: { booking_cancellation: "booking" },
  }, options: { idempotencyKey: "booking-cancellation:booking" } }]);
});

test("retry recovers a previous refund without moving money again", async () => {
  const { stripe, calls } = fakeStripe([
    { id: "re_unrelated", amount: 100, status: "succeeded", metadata: {} },
    { id: "re_existing", amount: 250, status: "pending", metadata: { booking_cancellation: "booking" } },
  ]);
  assert.equal(await requestCancellationRefund(stripe, "booking", "pi_test", 250), "re_existing");
  assert.equal(calls.length, 0);
});

test("pending refunds are accepted; failed, canceled and actionable refunds are not", async () => {
  for (const status of ["pending", "failed", "canceled", "requires_action"]) {
    const { stripe } = fakeStripe([], status);
    const result = requestCancellationRefund(stripe, "booking", "pi_test", 250);
    if (status === "pending") assert.equal(await result, "re_test");
    else await assert.rejects(result, /needs attention/);
  }
});

test("a mismatched previous refund is never reported as success", async () => {
  const { stripe, calls } = fakeStripe([
    { id: "re_existing", amount: 100, status: "succeeded", metadata: { booking_cancellation: "booking" } },
  ]);
  await assert.rejects(requestCancellationRefund(stripe, "booking", "pi_test", 250), /needs attention/);
  assert.equal(calls.length, 0);
});

test("network errors propagate and invalid amounts never reach Stripe", async () => {
  const { stripe, calls } = fakeStripe();
  for (const amount of [0, -1, 0.5, NaN]) {
    await assert.rejects(requestCancellationRefund(stripe, "booking", "pi_test", amount), /Invalid/);
  }
  assert.equal(calls.length, 0);
  stripe.refunds.create = async () => { throw new Error("network failure"); };
  await assert.rejects(requestCancellationRefund(stripe, "booking", "pi_test", 250), /network failure/);
});
