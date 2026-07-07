// Shared input validators and bounds. Server actions accept untrusted input from
// public forms and tampered query strings, so everything user-supplied is validated
// here before it reaches the database or a formatter that can throw.

// Field length caps — keep text columns bounded so a hostile client can't POST a
// multi-megabyte "name" and exhaust memory / bloat the table.
export const MAX_NAME_LEN = 120;
export const MAX_EMAIL_LEN = 254; // RFC 5321 upper bound
export const MAX_PHONE_LEN = 40;
export const MAX_URL_LEN = 2048;
export const MAX_REASON_LEN = 200;
export const MAX_PARTY_SIZE = 100;
export const MAX_CAPACITY = 100_000;
export const MAX_DURATION_MIN = 24 * 60;

// Deliberately simple: reject obvious non-addresses without trying to fully parse RFC 5322.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
// Lenient 8-4-4-4-12 hex — matches exactly what Postgres's uuid type accepts, so
// any real gen_random_uuid() passes while injection-y strings are rejected. The
// point is to guard `eq(col, id)` on uuid columns, which otherwise throws
// "invalid input syntax for type uuid" (500) on a tampered id.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(v: string): boolean {
  return UUID_RE.test(v);
}

export function isValidEmail(v: string): boolean {
  return v.length <= MAX_EMAIL_LEN && EMAIL_RE.test(v);
}

export function isHexColor(v: string): boolean {
  return HEX_COLOR_RE.test(v);
}

export function isDateStr(v: string): boolean {
  if (!DATE_RE.test(v)) return false;
  // Reject impossible calendar dates like 2026-02-31 that pass the regex.
  const [y, m, d] = v.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function isTimeStr(v: string): boolean {
  return TIME_RE.test(v);
}

/** true only for a syntactically valid http(s) URL within the length cap. */
export function isHttpUrl(v: string): boolean {
  if (v.length > MAX_URL_LEN) return false;
  let u: URL;
  try {
    u = new URL(v);
  } catch {
    return false;
  }
  return u.protocol === "http:" || u.protocol === "https:";
}

/** true if `tz` is an IANA zone the runtime's Intl accepts (else formatters throw). */
export function isValidTimeZone(tz: string): boolean {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse an integer from form input, clamped to [min, max]. Returns `fallback`
 * (already assumed in range) when the value is missing or not a finite integer.
 */
export function parseBoundedInt(
  v: FormDataEntryValue | null,
  min: number,
  max: number,
  fallback: number,
): number {
  const n = parseInt(String(v ?? ""), 10);
  if (!Number.isFinite(n)) return fallback;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

/** Trim and hard-cap a free-text field. */
export function cleanText(v: FormDataEntryValue | null, maxLen: number): string {
  return String(v ?? "").trim().slice(0, maxLen);
}
