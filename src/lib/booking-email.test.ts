import { test } from "node:test";
import assert from "node:assert/strict";
import { POST } from "../app/api/public/bookings/route";

test("booking API rejects absent, blank, malformed and overlong emails before database access", async () => {
  const previous = process.env.BOOKING_API_KEY;
  process.env.BOOKING_API_KEY = "local-test-key";
  try {
    for (const email of [undefined, null, "", "   ", "invalid", `${"a".repeat(250)}@example.com`]) {
      const response = await POST(new Request("http://localhost/api/public/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": "local-test-key" },
        body: JSON.stringify({ slug: "test", date: "2026-12-01", startAt: "2026-12-01T12:00:00Z",
          partySize: 2, customerName: "Test Customer", phone: "+34600000000", email }),
      }));
      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), { error: "invalid_email" });
    }
  } finally {
    if (previous === undefined) delete process.env.BOOKING_API_KEY;
    else process.env.BOOKING_API_KEY = previous;
  }
});
