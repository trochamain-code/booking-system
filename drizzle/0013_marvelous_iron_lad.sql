DROP INDEX "uniq_confirmed_slot";--> statement-breakpoint
-- Pooled capacity (aforo): several confirmed bookings may now share a resource+slot,
-- so the one-booking-per-resource exclusion constraint has to go. The capacity rule is
-- enforced transactionally in insertBookingWithCapacityCheck.
ALTER TABLE "bookings" DROP CONSTRAINT "no_overlap_confirmed";
