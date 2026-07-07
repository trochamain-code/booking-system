import crypto from "node:crypto";

// Pure session-token logic (HMAC sign / encode / decode), with no dependency on
// Next's request context so it can be unit-tested. The Next cookie plumbing lives
// in session.ts.

export type Role = "super_admin" | "owner" | "staff";
export type SessionData = {
  userId: string;
  role: Role;
  companyId: string | null;
  exp: number; // unix seconds
};

// The docker-compose dev fallback. Refuse to sign sessions with it in production —
// a known secret means anyone can forge an admin cookie.
const DEV_DEFAULT_SECRET = "dev_change_me_use_a_real_32_byte_secret_in_prod";

export function sessionSecret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  if (process.env.NODE_ENV === "production") {
    if (s === DEV_DEFAULT_SECRET) {
      throw new Error("AUTH_SECRET is still the insecure dev default — set a real 32-byte secret.");
    }
    if (s.length < 32) {
      throw new Error("AUTH_SECRET is too short — use at least 32 bytes of entropy in production.");
    }
  }
  return s;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

export function encodeSession(data: SessionData): string {
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/**
 * Verify and parse a session token. Returns null on any tampering, bad format,
 * or expiry. `nowSec` is injectable for testing; defaults to the current time.
 */
export function decodeSession(token: string, nowSec = Math.floor(Date.now() / 1000)): SessionData | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as SessionData;
    if (typeof data.exp !== "number" || data.exp < nowSec) return null;
    return data;
  } catch {
    return null;
  }
}
