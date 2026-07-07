ALTER TABLE "companies" ADD COLUMN "stripe_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "stripe_secret_key" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "stripe_publishable_key" text;--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "price_cents" integer;