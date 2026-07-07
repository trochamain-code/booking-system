import { test } from "node:test";
import assert from "node:assert/strict";
import { availableSlots, dayRangeUtc, weekday, type AvailabilityInput } from "./availability";

const DATE = "2026-07-10"; // a Friday
const DOW = new Date(`${DATE}T00:00:00Z`).getUTCDay();

function base(overrides: Partial<AvailabilityInput> = {}): AvailabilityInput {
  return {
    date: DATE,
    partySize: 2,
    timezone: "UTC",
    slotIntervalMin: 60,
    durationMin: 60,
    resources: [{ id: "t2", capacity: 2, active: true }],
    hours: [{ dayOfWeek: DOW, openTime: "18:00", closeTime: "21:00" }],
    closures: [],
    bookings: [],
    ...overrides,
  };
}

const times = (input: AvailabilityInput) => availableSlots(input).map((s) => s.time);

test("closure date yields no slots", () => {
  assert.deepEqual(times(base({ closures: [DATE] })), []);
});

test("a weekday with no hours yields no slots", () => {
  assert.deepEqual(times(base({ hours: [{ dayOfWeek: (DOW + 1) % 7, openTime: "18:00", closeTime: "21:00" }] })), []);
});

test("generates slots within opening hours, excluding ones that overrun close", () => {
  // 18:00 open, 21:00 close, 60-min slots of 60-min duration -> 18,19,20 (21 would overrun)
  assert.deepEqual(times(base()), ["18:00", "19:00", "20:00"]);
});

test("a slot disappears when its only fitting resource is booked over an overlapping window", () => {
  const booked = base({
    bookings: [{ resourceId: "t2", startAt: new Date(`${DATE}T19:00:00Z`), durationMin: 60 }],
  });
  assert.deepEqual(times(booked), ["18:00", "20:00"]);
});

test("a booking on a different resource does not block the slot", () => {
  const input = base({
    resources: [
      { id: "t2a", capacity: 2, active: true },
      { id: "t2b", capacity: 2, active: true },
    ],
    bookings: [{ resourceId: "t2a", startAt: new Date(`${DATE}T19:00:00Z`), durationMin: 60 }],
  });
  assert.deepEqual(times(input), ["18:00", "19:00", "20:00"]);
});

test("party only gets slots on a resource large enough", () => {
  const input = base({
    partySize: 6,
    resources: [
      { id: "t2", capacity: 2, active: true },
      { id: "t6", capacity: 6, active: true },
    ],
  });
  const slots = availableSlots(input);
  assert.equal(slots.length, 3);
  assert.ok(slots.every((s) => s.resourceId === "t6"), "party of 6 assigned only to the 6-seat resource");
});

test("auto-assigns the smallest fitting resource", () => {
  const input = base({
    partySize: 2,
    resources: [
      { id: "t6", capacity: 6, active: true },
      { id: "t2", capacity: 2, active: true },
    ],
  });
  assert.equal(availableSlots(input)[0].resourceId, "t2");
});

test("inactive resource is ignored", () => {
  const input = base({ resources: [{ id: "t2", capacity: 2, active: false }] });
  assert.deepEqual(times(input), []);
});

test("split shift produces slots in both ranges", () => {
  const input = base({
    hours: [
      { dayOfWeek: DOW, openTime: "11:00", closeTime: "13:00" },
      { dayOfWeek: DOW, openTime: "18:00", closeTime: "20:00" },
    ],
  });
  assert.deepEqual(times(input), ["11:00", "12:00", "18:00", "19:00"]);
});

test("resolves wall-clock times against the company timezone (EDT = UTC-4 in July)", () => {
  const input = base({ timezone: "America/New_York" });
  // 18:00 New York on 2026-07-10 == 22:00 UTC
  assert.equal(availableSlots(input)[0].startAt, "2026-07-10T22:00:00.000Z");
});

test("nowMs excludes slots at or before the current instant (no past bookings)", () => {
  // Slots are 18:00, 19:00, 20:00 UTC. With now = 19:30 UTC only 20:00 survives.
  const input = base({ nowMs: Date.parse("2026-07-10T19:30:00Z") });
  assert.deepEqual(times(input), ["20:00"]);
});

test("nowMs in the past keeps every slot", () => {
  const input = base({ nowMs: Date.parse("2000-01-01T00:00:00Z") });
  assert.deepEqual(times(input), ["18:00", "19:00", "20:00"]);
});

test("dayRangeUtc spans midnight-to-midnight in the given timezone", () => {
  const utc = dayRangeUtc("2026-07-10", "UTC");
  assert.equal(utc.start.toISOString(), "2026-07-10T00:00:00.000Z");
  assert.equal(utc.end.toISOString(), "2026-07-11T00:00:00.000Z");

  // New York is UTC-4 in July, so its calendar day starts at 04:00 UTC.
  const ny = dayRangeUtc("2026-07-10", "America/New_York");
  assert.equal(ny.start.toISOString(), "2026-07-10T04:00:00.000Z");
  assert.equal(ny.end.toISOString(), "2026-07-11T04:00:00.000Z");
});

test("weekday returns the calendar day-of-week (2026-07-10 is a Friday)", () => {
  assert.equal(weekday("2026-07-10"), 5);
  assert.equal(weekday("2026-07-12"), 0); // Sunday
});
