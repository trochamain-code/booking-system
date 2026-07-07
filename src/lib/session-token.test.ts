import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeSession, decodeSession } from "./session-token";

// The secret is read lazily inside sign(), so setting it here (before any test
// callback runs) is sufficient — no dynamic import needed.
process.env.AUTH_SECRET = "test-secret-please-ignore-32bytes-minimum-xxxxx";

const base = { userId: "u1", role: "owner" as const, companyId: "c1", exp: 4102444800 }; // 2100

test("round-trips a valid session", () => {
  const token = encodeSession(base);
  assert.deepEqual(decodeSession(token), base);
});

test("rejects a token with a tampered payload", () => {
  const token = encodeSession(base);
  const [, sig] = token.split(".");
  const forged = Buffer.from(JSON.stringify({ ...base, role: "super_admin" })).toString("base64url");
  assert.equal(decodeSession(`${forged}.${sig}`), null);
});

test("rejects a token with a tampered signature", () => {
  const [payload] = encodeSession(base).split(".");
  assert.equal(decodeSession(`${payload}.deadbeef`), null);
});

test("rejects a token signed with a different secret", () => {
  const token = encodeSession(base);
  process.env.AUTH_SECRET = "a-totally-different-secret-value-32bytes-xxxx";
  assert.equal(decodeSession(token), null);
  process.env.AUTH_SECRET = "test-secret-please-ignore-32bytes-minimum-xxxxx";
});

test("rejects an expired token", () => {
  const expired = { ...base, exp: 1000 }; // 1970
  const token = encodeSession(expired);
  assert.equal(decodeSession(token, 2000), null);
});

test("accepts a token that is not yet expired via injected now", () => {
  const token = encodeSession({ ...base, exp: 5000 });
  assert.ok(decodeSession(token, 4999));
});

test("rejects malformed tokens", () => {
  assert.equal(decodeSession(""), null);
  assert.equal(decodeSession("no-dot"), null);
  assert.equal(decodeSession("a.b.c"), null);
  assert.equal(decodeSession(".sig"), null);
});
