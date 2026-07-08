"use client";

import { useEffect } from "react";

/**
 * Sends the customer to Stripe Checkout at the TOP window level — Checkout
 * refuses to load inside an iframe, and the widget is usually embedded.
 * If the embedder's sandbox blocks top navigation, the visible fallback
 * button (target="_top") on the page remains the manual path.
 */
export function StripeRedirect({ url }: { url: string }) {
  useEffect(() => {
    if (window.self === window.top) {
      window.location.assign(url);
      return;
    }
    try {
      window.top?.location.assign(url);
    } catch {
      // Sandboxed without allow-top-navigation: the user clicks the button.
    }
  }, [url]);

  return null;
}
