ALTER TABLE "bookings" ADD COLUMN "cancellation_refund_cents" integer;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "stripe_refund_id" text;