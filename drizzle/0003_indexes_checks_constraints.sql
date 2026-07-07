CREATE INDEX "bookings_company_start_idx" ON "bookings" USING btree ("company_id","start_at");--> statement-breakpoint
CREATE INDEX "bookings_company_status_start_idx" ON "bookings" USING btree ("company_id","status","start_at");--> statement-breakpoint
CREATE INDEX "bookings_resource_start_idx" ON "bookings" USING btree ("resource_id","start_at");--> statement-breakpoint
CREATE INDEX "closures_company_idx" ON "closures" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "closures_company_date_uniq" ON "closures" USING btree ("company_id","date");--> statement-breakpoint
CREATE INDEX "opening_hours_company_idx" ON "opening_hours" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "resources_company_idx" ON "resources" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "users_company_idx" ON "users" USING btree ("company_id");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_party_size_pos" CHECK ("bookings"."party_size" > 0);--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_duration_pos" CHECK ("bookings"."duration_min" > 0);--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_slot_interval_pos" CHECK ("companies"."slot_interval_min" > 0);--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_default_duration_pos" CHECK ("companies"."default_duration_min" > 0);--> statement-breakpoint
ALTER TABLE "opening_hours" ADD CONSTRAINT "opening_hours_dow_range" CHECK ("opening_hours"."day_of_week" >= 0 AND "opening_hours"."day_of_week" <= 6);--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_capacity_pos" CHECK ("resources"."capacity" > 0);