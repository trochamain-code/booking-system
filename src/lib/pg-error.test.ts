import { test } from "node:test";
import assert from "node:assert/strict";
import { hasPgCode, PG_EXCLUSION_VIOLATION, PG_UNIQUE_VIOLATION } from "./pg-error";

test("detects a code on the top-level error", () => {
  assert.equal(hasPgCode({ code: PG_UNIQUE_VIOLATION }, PG_UNIQUE_VIOLATION), true);
});

test("detects a code nested on .cause (Drizzle-wrapped shape)", () => {
  // This is the real shape: DrizzleQueryError { cause: PostgresError { code } }.
  const wrapped = { name: "DrizzleQueryError", cause: { code: PG_EXCLUSION_VIOLATION } };
  assert.equal(hasPgCode(wrapped, PG_UNIQUE_VIOLATION, PG_EXCLUSION_VIOLATION), true);
});

test("returns false for an unrelated error", () => {
  assert.equal(hasPgCode(new Error("boom"), PG_UNIQUE_VIOLATION), false);
  assert.equal(hasPgCode({ cause: { code: "42P01" } }, PG_UNIQUE_VIOLATION), false);
  assert.equal(hasPgCode(null, PG_UNIQUE_VIOLATION), false);
  assert.equal(hasPgCode(undefined, PG_UNIQUE_VIOLATION), false);
});

test("stops on a cyclic cause chain without hanging", () => {
  const a: { cause?: unknown; code?: string } = {};
  a.cause = a; // cycle
  assert.equal(hasPgCode(a, PG_UNIQUE_VIOLATION), false);
});
