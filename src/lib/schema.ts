import { sql } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  date,
  timestamp,
  uniqueIndex,
  index,
  check,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["super_admin", "owner", "staff"]);

export const companies = pgTable(
  "companies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    timezone: text("timezone").notNull().default("UTC"),
    logoUrl: text("logo_url"),
    primaryColor: text("primary_color").notNull().default("#111827"),
    welcomeText: text("welcome_text"),
    senderName: text("sender_name").notNull().default(""),
    contactInfo: text("contact_info"),
    slotIntervalMin: integer("slot_interval_min").notNull().default(15),
    defaultDurationMin: integer("default_duration_min").notNull().default(90),
    stripeEnabled: boolean("stripe_enabled").notNull().default(false),
    stripeSecretKey: text("stripe_secret_key"),
    stripePublishableKey: text("stripe_publishable_key"),
    // Signing secret + endpoint id of the checkout webhook auto-provisioned in
    // THIS company's Stripe account (each tenant has its own account).
    stripeWebhookSecret: text("stripe_webhook_secret"),
    stripeWebhookEndpointId: text("stripe_webhook_endpoint_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("companies_slot_interval_pos", sql`${t.slotIntervalMin} > 0`),
    check("companies_default_duration_pos", sql`${t.defaultDurationMin} > 0`),
  ],
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    role: roleEnum("role").notNull(),
    // null for super_admin; set for owner/staff
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("users_company_idx").on(t.companyId)],
);

export const resources = pgTable(
  "resources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    capacity: integer("capacity").notNull().default(1),
    priceCents: integer("price_cents"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("resources_company_idx").on(t.companyId),
    check("resources_capacity_pos", sql`${t.capacity} > 0`),
  ],
);

// Weekly opening hours as wall-clock "HH:MM" in the company timezone.
// Multiple rows per weekday = split shifts (e.g. 11:00-15:00 and 18:00-23:00).
export const openingHours = pgTable(
  "opening_hours",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    dayOfWeek: integer("day_of_week").notNull(), // 0=Sunday .. 6=Saturday
    openTime: text("open_time").notNull(), // "HH:MM"
    closeTime: text("close_time").notNull(), // "HH:MM"
  },
  (t) => [
    index("opening_hours_company_idx").on(t.companyId),
    check("opening_hours_dow_range", sql`${t.dayOfWeek} >= 0 AND ${t.dayOfWeek} <= 6`),
  ],
);

// One-off closed days (holidays / maintenance) that block all slots.
export const closures = pgTable(
  "closures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    date: date("date").notNull(), // "YYYY-MM-DD"
    reason: text("reason"),
  },
  (t) => [
    index("closures_company_idx").on(t.companyId),
    // One closure per company per day; addClosure relies on this for onConflictDoNothing.
    uniqueIndex("closures_company_date_uniq").on(t.companyId, t.date),
  ],
);

export const bookingStatusEnum = pgEnum("booking_status", ["confirmed", "cancelled"]);

/**
 * Cancellation / refund policies per company.
 *
 * Two rule types:
 *   "after_booking" — grace period. If cancelled within threshold_minutes of
 *     booking creation, the customer gets refund_percent back. Rules are
 *     evaluated in ascending threshold order; first match wins.
 *
 *   "before_event"  — proximity to event. If cancelled with at least
 *     threshold_minutes before start_at, the customer gets refund_percent back.
 *     Rules are evaluated in descending threshold order (most generous first);
 *     first match wins.
 *
 * If no rule matches, the refund is 0 % (the business keeps the money).
 */
export const cancellationPolicies = pgTable(
  "cancellation_policies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    ruleType: text("rule_type", { enum: ["after_booking", "before_event"] }).notNull(),
    thresholdMinutes: integer("threshold_minutes").notNull(),
    refundPercent: integer("refund_percent").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("cancellation_policies_company_idx").on(t.companyId),
    index("cancellation_policies_company_type_idx").on(t.companyId, t.ruleType),
    check("cancellation_policies_threshold_pos", sql`${t.thresholdMinutes} >= 0`),
    check("cancellation_policies_refund_range", sql`${t.refundPercent} >= 0 AND ${t.refundPercent} <= 100`),
  ],
);

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    customerName: text("customer_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    comments: text("comments"),
    partySize: integer("party_size").notNull(),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    durationMin: integer("duration_min").notNull(),
    status: bookingStatusEnum("status").notNull().default("confirmed"),
    token: text("token").notNull().unique(),
    // Set only on paid bookings: enough to find the charge and refund it.
    stripeSessionId: text("stripe_session_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    amountCents: integer("amount_cents"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Backstop against the exact-same-slot race; cancelled rows drop out so the slot frees.
    // (The no_overlap_confirmed EXCLUDE constraint added in migration 0003 is the real
    // guard against overlapping-but-offset bookings — see that migration.)
    uniqueIndex("uniq_confirmed_slot")
      .on(t.resourceId, t.startAt)
      .where(sql`${t.status} = 'confirmed'`),
    // Dashboard & availability read bookings by company within a day window.
    index("bookings_company_start_idx").on(t.companyId, t.startAt),
    index("bookings_company_status_start_idx").on(t.companyId, t.status, t.startAt),
    // FK lookups + the overlap scan join on resource.
    index("bookings_resource_start_idx").on(t.resourceId, t.startAt),
    check("bookings_party_size_pos", sql`${t.partySize} > 0`),
    check("bookings_duration_pos", sql`${t.durationMin} > 0`),
  ],
);

export type Company = typeof companies.$inferSelect;
export type User = typeof users.$inferSelect;
export type Resource = typeof resources.$inferSelect;
export type OpeningHour = typeof openingHours.$inferSelect;
export type Closure = typeof closures.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
