import { test } from "node:test";
import assert from "node:assert/strict";
import { rateLimit } from "./rate-limit";

// Each test uses a unique key so the shared in-process map doesn't leak between tests.
let n = 0;
const key = () => `t${n++}-${Math.floor(performance.now())}`;

test("allows up to the limit, then blocks within the window", () => {
  const k = key();
  assert.equal(rateLimit(k, 3, 60_000).ok, true);
  assert.equal(rateLimit(k, 3, 60_000).ok, true);
  assert.equal(rateLimit(k, 3, 60_000).ok, true);
  const blocked = rateLimit(k, 3, 60_000);
  assert.equal(blocked.ok, false);
  assert.ok(blocked.retryAfterSec >= 1);
});

test("a tiny window resets so a later call is allowed again", async () => {
  const k = key();
  assert.equal(rateLimit(k, 1, 20).ok, true);
  assert.equal(rateLimit(k, 1, 20).ok, false);
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(rateLimit(k, 1, 20).ok, true); // window elapsed → fresh budget
});

test("separate keys have independent budgets", () => {
  const a = key();
  const b = key();
  assert.equal(rateLimit(a, 1, 60_000).ok, true);
  assert.equal(rateLimit(a, 1, 60_000).ok, false);
  assert.equal(rateLimit(b, 1, 60_000).ok, true); // b unaffected by a
});
