import Stripe from "stripe";

// No pinned apiVersion: the SDK sends the version it was built against, which is
// always valid — a hand-pinned string (previously "2025-03-31" cast to any) is
// rejected by Stripe as an unknown version and breaks every API call.
export function createStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey);
}

export const WEBHOOK_EVENTS = ["checkout.session.completed", "checkout.session.async_payment_succeeded"] as const;

export function companyWebhookUrl(companyId: string): string {
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  return `${appUrl}/api/stripe/webhook/${companyId}`;
}

/**
 * Register our fulfillment webhook in a tenant's Stripe account and return the
 * endpoint id + signing secret (the secret is only revealed at creation).
 */
export async function createCompanyWebhook(
  secretKey: string,
  companyId: string,
  companyName: string,
): Promise<{ endpointId: string; secret: string }> {
  const stripe = createStripeClient(secretKey);
  const endpoint = await stripe.webhookEndpoints.create({
    url: companyWebhookUrl(companyId),
    enabled_events: [...WEBHOOK_EVENTS],
    description: `Sistema de reservas — ${companyName}`,
  });
  if (!endpoint.secret) throw new Error("Stripe did not return a webhook signing secret");
  return { endpointId: endpoint.id, secret: endpoint.secret };
}

/** Best-effort removal of a previously provisioned webhook endpoint. */
export async function deleteCompanyWebhook(secretKey: string, endpointId: string): Promise<void> {
  try {
    await createStripeClient(secretKey).webhookEndpoints.del(endpointId);
  } catch (err) {
    // The key may have been rotated or the endpoint deleted by hand — a stale
    // endpoint in a Stripe account we can no longer reach is harmless.
    console.error("stripe webhook delete failed:", err);
  }
}
