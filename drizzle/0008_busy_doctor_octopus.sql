ALTER TABLE "bookings" ADD COLUMN "stripe_session_id" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "stripe_payment_intent_id" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "amount_cents" integer;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "stripe_webhook_secret" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "stripe_webhook_endpoint_id" text;