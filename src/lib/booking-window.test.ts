import { test } from "node:test";
import assert from "node:assert/strict";
import { isBookingDateAllowed, lastBookingDate } from "./booking-window";
import { getAvailability } from "./booking-data";
import type { Company } from "./schema";

const slug = "la-madriguera-de-mai";

test("Madriguera accepts dates through January 1, 2027 inclusive", () => {
  assert.equal(lastBookingDate(slug), "2027-01-01");
  assert.equal(isBookingDateAllowed(slug, "2026-12-31"), true);
  assert.equal(isBookingDateAllowed(slug, "2027-01-01"), true);
  assert.equal(isBookingDateAllowed(slug, "2027-01-02"), false);
  assert.equal(isBookingDateAllowed(slug, "2028-01-01"), false);
});

test("other companies have no fixed cutoff", () => {
  assert.equal(lastBookingDate("another-company"), undefined);
  assert.equal(isBookingDateAllowed("another-company", "2027-01-02"), true);
  assert.equal(isBookingDateAllowed("another-company", "2028-01-01"), true);
});

test("server availability rejects dates after cutoff, including manual bookings", async () => {
  // The cutoff must reject before any database access or opening-hour checks.
  const company = { slug, timezone: "Europe/Madrid" } as Company;
  for (const date of ["2027-01-02", "2027-12-31", "2028-01-01"]) {
    assert.deepEqual(await getAvailability(company, date, 2), []);
    assert.deepEqual(await getAvailability(company, date, 2, { includePast: true }), []);
  }
});
