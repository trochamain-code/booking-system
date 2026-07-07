-- Enforce the core invariant at the database level: a single resource can never
-- hold two overlapping CONFIRMED bookings. The btree unique index on
-- (resource_id, start_at) only catches identical start times; two bookings that
-- overlap at *different* start times (e.g. 18:00+90m and 18:30+90m) slip past it,
-- and the app-level availability re-check has a TOCTOU race under concurrency.
--
-- A GiST exclusion constraint over the booking's time range closes both: Postgres
-- rejects any confirmed insert whose [start, start+duration) range overlaps an
-- existing confirmed booking on the same resource — atomically, race-free.

CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint

-- timestamptz + interval is only marked STABLE (for DST-sensitive day/month
-- intervals). Our durations are pure minutes, so the arithmetic is genuinely
-- immutable; wrap it in an IMMUTABLE function so it can be used in the index.
CREATE OR REPLACE FUNCTION booking_tstzrange(p_start timestamptz, p_duration_min integer)
RETURNS tstzrange
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
  SELECT tstzrange(p_start, p_start + make_interval(mins => p_duration_min));
$$;--> statement-breakpoint

ALTER TABLE "bookings" ADD CONSTRAINT "no_overlap_confirmed"
  EXCLUDE USING gist (
    resource_id WITH =,
    booking_tstzrange(start_at, duration_min) WITH &&
  ) WHERE (status = 'confirmed');
