import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isValidEmail,
  isHexColor,
  isDateStr,
  isTimeStr,
  isHttpUrl,
  isValidTimeZone,
  isUuid,
  parseBoundedInt,
  cleanText,
} from "./validation";

test("isValidEmail", () => {
  assert.equal(isValidEmail("a@b.co"), true);
  assert.equal(isValidEmail("no-at"), false);
  assert.equal(isValidEmail("a@b"), false);
  assert.equal(isValidEmail("a b@c.d"), false);
  assert.equal(isValidEmail(`${"x".repeat(250)}@b.co`), false); // over length cap
});

test("isHexColor accepts #rgb and #rrggbb only", () => {
  assert.equal(isHexColor("#fff"), true);
  assert.equal(isHexColor("#b91c1c"), true);
  assert.equal(isHexColor("red"), false);
  assert.equal(isHexColor("#12"), false);
  assert.equal(isHexColor("#b91c1c; background:url(x)"), false); // CSS-injection attempt
});

test("isDateStr rejects impossible calendar dates", () => {
  assert.equal(isDateStr("2026-07-10"), true);
  assert.equal(isDateStr("2026-02-31"), false);
  assert.equal(isDateStr("2026-13-01"), false);
  assert.equal(isDateStr("July 10"), false);
});

test("isTimeStr", () => {
  assert.equal(isTimeStr("18:00"), true);
  assert.equal(isTimeStr("23:59"), true);
  assert.equal(isTimeStr("24:00"), false);
  assert.equal(isTimeStr("9:00"), false);
});

test("isHttpUrl only allows http(s)", () => {
  assert.equal(isHttpUrl("https://ex.com/logo.png"), true);
  assert.equal(isHttpUrl("http://ex.com"), true);
  assert.equal(isHttpUrl("javascript:alert(1)"), false);
  assert.equal(isHttpUrl("data:image/png;base64,x"), false);
  assert.equal(isHttpUrl("not a url"), false);
});

test("isValidTimeZone", () => {
  assert.equal(isValidTimeZone("Europe/Madrid"), true);
  assert.equal(isValidTimeZone("UTC"), true);
  assert.equal(isValidTimeZone("Europe/Notreal"), false);
  assert.equal(isValidTimeZone(""), false);
});

test("isUuid", () => {
  assert.equal(isUuid("f47ac10b-58cc-4372-a567-0e02b2c3d479"), true);
  assert.equal(isUuid("not-a-uuid"), false);
  assert.equal(isUuid("11111111-1111-1111-1111-111111111111"), true);
  assert.equal(isUuid("'; drop table bookings; --"), false);
});

test("parseBoundedInt clamps and falls back", () => {
  assert.equal(parseBoundedInt("5", 1, 10, 2), 5);
  assert.equal(parseBoundedInt("0", 1, 10, 2), 1); // clamp to min
  assert.equal(parseBoundedInt("999", 1, 10, 2), 10); // clamp to max
  assert.equal(parseBoundedInt("abc", 1, 10, 2), 2); // fallback
  assert.equal(parseBoundedInt(null, 1, 10, 2), 2);
});

test("cleanText trims and caps length", () => {
  assert.equal(cleanText("  hi  ", 10), "hi");
  assert.equal(cleanText("x".repeat(20), 5), "xxxxx");
  assert.equal(cleanText(null, 5), "");
});
