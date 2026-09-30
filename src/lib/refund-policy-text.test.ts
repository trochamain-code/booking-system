import { test } from "node:test";
import assert from "node:assert/strict";
import { refundPolicyText } from "./refund-policy-text";

test("refund policy lists grace periods first and advance notice rules longest first", () => {
  const rules = [
    { ruleType: "before_event" as const, thresholdMinutes: 60, refundPercent: 25 },
    { ruleType: "after_booking" as const, thresholdMinutes: 30, refundPercent: 50 },
    { ruleType: "before_event" as const, thresholdMinutes: 1440, refundPercent: 75 },
    { ruleType: "after_booking" as const, thresholdMinutes: 10, refundPercent: 100 },
  ];
  const original = structuredClone(rules);
  const lines = refundPolicyText(rules);
  assert.match(lines[0], /primera regla/);
  assert.match(lines[1], /dentro de 10 minutos.*100%/);
  assert.match(lines[2], /dentro de 30 minutos.*50%/);
  assert.match(lines[3], /al menos 1 día.*75%/);
  assert.match(lines[4], /al menos 1 hora.*25%/);
  assert.match(lines[5], /no corresponde reembolso/);
  assert.deepEqual(rules, original);
});

test("no configured rules explicitly means no refund", () => {
  assert.deepEqual(refundPolicyText([]), ["El establecimiento no ofrece reembolsos por cancelación."]);
});

test("zero percent and zero minute rules are retained rather than omitted", () => {
  const lines = refundPolicyText([
    { ruleType: "after_booking", thresholdMinutes: 0, refundPercent: 0 },
    { ruleType: "before_event", thresholdMinutes: 90, refundPercent: 50 },
  ]);
  assert.match(lines[1], /0 minutos.*0%/);
  assert.match(lines[2], /90 minutos.*50%/);
});
