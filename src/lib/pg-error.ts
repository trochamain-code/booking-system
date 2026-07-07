// Postgres SQLSTATE codes we handle explicitly.
export const PG_UNIQUE_VIOLATION = "23505";
export const PG_EXCLUSION_VIOLATION = "23P01";

/**
 * Does `err` (or anything in its `.cause` chain) carry one of `codes`?
 *
 * Drizzle wraps driver errors in a DrizzleQueryError and puts the original
 * postgres error — the one that actually has `.code` — on `.cause`, so reading
 * `err.code` off the top-level error yields undefined. Walk the chain instead.
 */
export function hasPgCode(err: unknown, ...codes: string[]): boolean {
  for (let e: unknown = err, depth = 0; e && depth < 5; e = (e as { cause?: unknown }).cause, depth++) {
    const code = (e as { code?: string }).code;
    if (typeof code === "string" && codes.includes(code)) return true;
  }
  return false;
}
