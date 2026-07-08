"use server";

import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { cancellationPolicies } from "./schema";
import { createStripeClient } from "./stripe";

/**
 * Compute the refund percentage for a cancelled booking based on the
 * company's cancellation policies.
 *
 * 1. "after_booking" rules (grace period) — shortest threshold first.
 *    If minutes_since_booking <= threshold → use that refund_percent.
 * 2. "before_event" rules — longest threshold first.
 *    If minutes_to_event >= threshold → use that refund_percent.
 * 3. Default: 0 % (no refund).
 */
export async function computeRefundPercent(
  booking: { createdAt: Date; startAt: Date; amountCents: number | null },
  companyId: string,
): Promise<number> {
  if (!booking.amountCents) return 0;

  const policies = await db
    .select()
    .from(cancellationPolicies)
    .where(eq(cancellationPolicies.companyId, companyId))
    .orderBy(cancellationPolicies.ruleType, cancellationPolicies.thresholdMinutes);

  const now = Date.now();
  const minutesSinceBooking = (now - booking.createdAt.getTime()) / 60000;

  for (const rule of policies) {
    if (rule.ruleType !== "after_booking") continue;
    if (minutesSinceBooking <= rule.thresholdMinutes) {
      return rule.refundPercent;
    }
  }

  const minutesToEvent = (booking.startAt.getTime() - now) / 60000;

  const beforeEvent = policies
    .filter((r) => r.ruleType === "before_event")
    .sort((a, b) => b.thresholdMinutes - a.thresholdMinutes);

  for (const rule of beforeEvent) {
    if (minutesToEvent >= rule.thresholdMinutes) {
      return rule.refundPercent;
    }
  }

  return 0;
}

/**
 * Issue a Stripe refund for the given percentage of the payment.
 * Catches errors so the caller can proceed regardless.
 */
export async function refundBooking(
  stripePaymentIntentId: string,
  amountCents: number,
  refundPercent: number,
  stripeSecretKey: string,
): Promise<void> {
  if (refundPercent <= 0) return;

  const stripe = createStripeClient(stripeSecretKey);
  const refundAmount = Math.round(amountCents * refundPercent / 100);

  try {
    await stripe.refunds.create({
      payment_intent: stripePaymentIntentId,
      ...(refundAmount < amountCents ? { amount: refundAmount } : {}),
    });
  } catch (refundErr) {
    console.error("stripe refund failed:", refundErr);
  }
}

// ---- CRUD for owners ----

export async function saveCancellationPolicy(formData: FormData): Promise<void> {
  const { requireRole } = await import("./session");
  const session = await requireRole("owner", "staff");
  if (!session.companyId) throw new Error("Not authorized");

  const ruleType = String(formData.get("ruleType") ?? "");
  const thresholdMinutes = parseInt(formData.get("thresholdMinutes") as string, 10);
  const refundPercent = parseInt(formData.get("refundPercent") as string, 10);

  if (!["after_booking", "before_event"].includes(ruleType)) throw new Error("Invalid rule type");
  if (isNaN(thresholdMinutes) || thresholdMinutes < 0) throw new Error("Invalid threshold");
  if (isNaN(refundPercent) || refundPercent < 0 || refundPercent > 100) throw new Error("Invalid percent");

  await db.insert(cancellationPolicies).values({
    companyId: session.companyId,
    ruleType: ruleType as "after_booking" | "before_event",
    thresholdMinutes,
    refundPercent,
  });
}

export async function deleteCancellationPolicy(formData: FormData): Promise<void> {
  const { requireRole } = await import("./session");
  const session = await requireRole("owner", "staff");
  if (!session.companyId) throw new Error("Not authorized");

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");

  await db
    .delete(cancellationPolicies)
    .where(and(eq(cancellationPolicies.id, id), eq(cancellationPolicies.companyId, session.companyId)));
}

// ---- CRUD for super-admin ----

export async function adminSaveCancellationPolicy(formData: FormData): Promise<void> {
  const { requireRole } = await import("./session");
  await requireRole("super_admin");

  const companyId = String(formData.get("companyId") ?? "");
  const ruleType = String(formData.get("ruleType") ?? "");
  const thresholdMinutes = parseInt(formData.get("thresholdMinutes") as string, 10);
  const refundPercent = parseInt(formData.get("refundPercent") as string, 10);

  if (!companyId) throw new Error("Missing companyId");
  if (!["after_booking", "before_event"].includes(ruleType)) throw new Error("Invalid rule type");
  if (isNaN(thresholdMinutes) || thresholdMinutes < 0) throw new Error("Invalid threshold");
  if (isNaN(refundPercent) || refundPercent < 0 || refundPercent > 100) throw new Error("Invalid percent");

  await db.insert(cancellationPolicies).values({
    companyId,
    ruleType: ruleType as "after_booking" | "before_event",
    thresholdMinutes,
    refundPercent,
  });
}

export async function adminDeleteCancellationPolicy(formData: FormData): Promise<void> {
  const { requireRole } = await import("./session");
  await requireRole("super_admin");

  const id = String(formData.get("id") ?? "");
  const companyId = String(formData.get("companyId") ?? "");
  if (!id) throw new Error("Missing id");

  await db
    .delete(cancellationPolicies)
    .where(and(eq(cancellationPolicies.id, id), eq(cancellationPolicies.companyId, companyId)));
}
