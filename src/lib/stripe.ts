import Stripe from "stripe";

// No pinned apiVersion: the SDK sends the version it was built against, which is
// always valid — a hand-pinned string (previously "2025-03-31" cast to any) is
// rejected by Stripe as an unknown version and breaks every API call.
export function createStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey);
}
