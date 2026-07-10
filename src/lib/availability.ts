export type EngineResource = { id: string; capacity: number; active: boolean; priceCents: number | null };
export type EngineHour = { dayOfWeek: number; openTime: string; closeTime: string };
export type EngineBooking = { resourceId: string; startAt: Date; durationMin: number; partySize: number };
// remaining/capacity: seats still free on the assigned resource BEFORE this party books.
export type Slot = {
  time: string;
  startAt: string;
  resourceId: string;
  priceCents: number | null;
  remaining: number;
  capacity: number;
};

export type AvailabilityInput = {
  date: string; // YYYY-MM-DD (calendar date in the company timezone)
  partySize: number;
  timezone: string; // IANA, e.g. "America/New_York"
  slotIntervalMin: number;
  durationMin: number;
  resources: EngineResource[];
  hours: EngineHour[]; // all weekly ranges; filtered here by weekday
  closures: string[]; // YYYY-MM-DD dates that are fully closed
  bookings: EngineBooking[]; // confirmed bookings that could overlap this date
  nowMs?: number; // if set, slots starting at/before this instant are excluded (no past bookings)
};

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function fromMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function weekday(dateStr: string): number {
  const [y, mo, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
}

// Offset (ms) between a given instant's wall-clock in `tz` and UTC.
function tzOffsetMs(instant: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const p: Record<string, number> = {};
  for (const part of parts) if (part.type !== "literal") p[part.type] = Number(part.value);
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUTC - instant.getTime();
}

// Convert a wall-clock time (minutes past midnight) on `dateStr` in `tz` to a UTC instant.
// ponytail: one-shot offset — off by an hour only for wall-times inside a DST gap/overlap,
// which fixed restaurant/opening hours almost never fall in. Upgrade to a tz lib if you ever
// schedule across the 1-hour spring-forward gap.
function zonedWallTimeToUtc(dateStr: string, minutes: number, tz: string): Date {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const guess = Date.UTC(y, mo - 1, d, Math.floor(minutes / 60), minutes % 60);
  return new Date(guess - tzOffsetMs(new Date(guess), tz));
}

// UTC window covering a calendar date in `tz` — used to fetch that day's bookings.
export function dayRangeUtc(dateStr: string, tz: string): { start: Date; end: Date } {
  return {
    start: zonedWallTimeToUtc(dateStr, 0, tz),
    end: zonedWallTimeToUtc(dateStr, 24 * 60, tz),
  };
}

// Bookings may run past closing time; guests just need to start at least this
// many minutes before close. (E.g. close 23:00 → last bookable slot 22:30.)
export const LAST_SLOT_BEFORE_CLOSE_MIN = 30;

export function availableSlots(input: AvailabilityInput): Slot[] {
  const { date, partySize, timezone, durationMin, resources, hours, closures, bookings } = input;
  const interval = Math.max(1, input.slotIntervalMin);

  if (partySize < 1) return [];
  if (closures.includes(date)) return [];

  const ranges = hours.filter((h) => h.dayOfWeek === weekday(date));
  if (ranges.length === 0) return [];

  // Smallest fitting resource first → auto-assign picks the tightest fit.
  const fitting = resources
    .filter((r) => r.active && r.capacity >= partySize)
    .sort((a, b) => a.capacity - b.capacity || a.id.localeCompare(b.id));
  if (fitting.length === 0) return [];

  const slots: Slot[] = [];
  const seen = new Set<string>();

  for (const range of ranges) {
    const open = toMinutes(range.openTime);
    const close = toMinutes(range.closeTime);
    for (let t = open; t + LAST_SLOT_BEFORE_CLOSE_MIN <= close; t += interval) {
      const time = fromMinutes(t);
      if (seen.has(time)) continue;

      const startAt = zonedWallTimeToUtc(date, t, timezone);
      const startMs = startAt.getTime();
      const endMs = startMs + durationMin * 60_000;

      // Never offer (or accept, via the write-time re-check) a slot in the past.
      if (input.nowMs !== undefined && startMs <= input.nowMs) continue;

      // Capacity pools: overlapping bookings share the resource, so a slot is
      // free while the sum of their party sizes leaves room for this party.
      let free: { resource: EngineResource; remaining: number } | undefined;
      for (const r of fitting) {
        let booked = 0;
        for (const b of bookings) {
          if (
            b.resourceId === r.id &&
            b.startAt.getTime() < endMs &&
            b.startAt.getTime() + b.durationMin * 60_000 > startMs
          ) {
            booked += b.partySize;
          }
        }
        const remaining = r.capacity - booked;
        if (remaining >= partySize) {
          free = { resource: r, remaining };
          break;
        }
      }

      if (free) {
        slots.push({
          time,
          startAt: startAt.toISOString(),
          resourceId: free.resource.id,
          priceCents: free.resource.priceCents,
          remaining: free.remaining,
          capacity: free.resource.capacity,
        });
        seen.add(time);
      }
    }
  }

  slots.sort((a, b) => a.startAt.localeCompare(b.startAt));
  return slots;
}
