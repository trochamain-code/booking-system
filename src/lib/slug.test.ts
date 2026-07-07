import { test } from "node:test";
import assert from "node:assert/strict";
import { slugify } from "./slug";

test("slugify lowercases and hyphenates spaces", () => {
  assert.equal(slugify("Bistro Uno"), "bistro-uno");
});

test("slugify strips punctuation and edge hyphens", () => {
  assert.equal(slugify("  Cafe del Mar!! "), "cafe-del-mar");
  assert.equal(slugify("--Hi--"), "hi");
});

test("slugify falls back to 'company' when empty", () => {
  assert.equal(slugify("!!!"), "company");
});
