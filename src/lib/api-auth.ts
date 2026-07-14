import crypto from "node:crypto";

/**
 * Shared-secret auth for the public integration API (/api/public/*).
 *
 * The key lives in the BOOKING_API_KEY env var. Callers pass it as either
 *   Authorization: Bearer <key>
 * or
 *   x-api-key: <key>
 *
 * This gate is intentionally simple and additive: it protects ONLY the new
 * /api/public routes used by external automations (the WhatsApp bot). It does
 * not touch the session-based auth of the dashboard or the public widget.
 */
export function apiKeyConfigured(): boolean {
  return !!process.env.BOOKING_API_KEY;
}

function timingSafeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/** Extract the presented key from Authorization: Bearer or x-api-key. */
function presentedKey(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth && auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  const x = req.headers.get("x-api-key");
  if (x) return x.trim();
  return null;
}

/**
 * Returns null when the request is authorized; otherwise a JSON error Response
 * that the route should return as-is.
 */
export function requireApiKey(req: Request): Response | null {
  const expected = process.env.BOOKING_API_KEY;
  if (!expected) {
    return Response.json(
      { error: "api_disabled", message: "BOOKING_API_KEY is not configured on the server" },
      { status: 503 },
    );
  }
  const got = presentedKey(req);
  if (!got || !timingSafeEqual(got, expected)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
