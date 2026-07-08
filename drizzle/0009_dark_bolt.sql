CREATE TABLE "cancellation_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"rule_type" text NOT NULL,
	"threshold_minutes" integer NOT NULL,
	"refund_percent" integer NOT NULL,
	"created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "cancellation_policies" ADD CONSTRAINT "cancellation_policies_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade;
--> statement-breakpoint
CREATE INDEX "cancellation_policies_company_idx" ON "cancellation_policies" USING btree ("company_id");
--> statement-breakpoint
CREATE INDEX "cancellation_policies_company_type_idx" ON "cancellation_policies" USING btree ("company_id", "rule_type");
--> statement-breakpoint
ALTER TABLE "cancellation_policies" ADD CONSTRAINT "cancellation_policies_threshold_pos" CHECK (threshold_minutes >= 0);
--> statement-breakpoint
ALTER TABLE "cancellation_policies" ADD CONSTRAINT "cancellation_policies_refund_range" CHECK (refund_percent >= 0 AND refund_percent <= 100);
