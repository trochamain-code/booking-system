import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "./password";

test("hashes and verifies a correct password", async () => {
  const hash = await hashPassword("correct horse battery staple");
  assert.ok(hash.includes(":"));
  assert.equal(await verifyPassword("correct horse battery staple", hash), true);
});

test("rejects an incorrect password", async () => {
  const hash = await hashPassword("s3cret");
  assert.equal(await verifyPassword("wrong", hash), false);
});

test("produces a distinct hash per call (random salt)", async () => {
  const a = await hashPassword("same");
  const b = await hashPassword("same");
  assert.notEqual(a, b);
  assert.equal(await verifyPassword("same", a), true);
  assert.equal(await verifyPassword("same", b), true);
});

test("returns false for a malformed stored hash", async () => {
  assert.equal(await verifyPassword("x", ""), false);
  assert.equal(await verifyPassword("x", "no-colon"), false);
  assert.equal(await verifyPassword("x", "nothex:nothex"), false);
});
