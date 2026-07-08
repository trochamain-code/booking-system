import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { companies } from "@/lib/schema";
import { createStripeClient } from "@/lib/stripe";
import { fulfillCheckoutSession } from "@/lib/stripe-fulfillment";
import { isUuid } from "@/lib/validation";

// Guaranteed fulfillment path: Stripe calls this when a Checkout session is
// paid, so the booking is created even if the customer never returns to the
// success page. The confirmed page (confirmPayment) races against this — the
// unique booking token makes both idempotent.
export async function POST(req: Request, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  if (!isUuid(companyId)) return new Response("unknown endpoint", { status: 404 });

  const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
  if (!company?.stripeSecretKey || !company.stripeWebhookSecret) {
    return new Response("webhook not configured", { status: 404 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("missing signature", { status: 400 });
  const payload = await req.text();

  const stripe = createStripeClient(company.stripeSecretKey);
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(payload, signature, company.stripeWebhookSecret);
  } catch (err) {
    console.error(`stripe webhook signature verification failed (company ${companyId}):`, err);
    return new Response("invalid signature", { status: 400 });
  }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object as Stripe.Checkout.Session;
    try {
      const result = await fulfillCheckoutSession(stripe, session, company);
      if (!result.ok && result.error === "not_found") {
        // Insert claimed to succeed but the booking can't be read back — retry.
        return new Response("fulfillment incomplete", { status: 500 });
      }
      if (!result.ok) {
        // not_paid / bad_metadata / slot_taken(+refund) are terminal outcomes;
        // a 2xx stops Stripe from retrying a session that can never fulfill.
        console.error(`stripe webhook: session ${session.id} not fulfilled:`, result);
      }
    } catch (err) {
      console.error(`stripe webhook fulfillment failed (session ${session.id}):`, err);
      return new Response("fulfillment failed", { status: 500 });
    }
  }

  return Response.json({ received: true });
}
