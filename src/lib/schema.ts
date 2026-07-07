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
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["super_admin", "owner", "staff"]);

export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  timezone: text("timezone").notNull().default("UTC"),
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color").notNull().default("#111827"),
  slotIntervalMin: integer("slot_interval_min").notNull().default(15),
  defaultDurationMin: integer("default_duration_min").notNull().default(90),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull(),
  // null for super_admin; set for owner/staff
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const resources = pgTable("resources", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  capacity: integer("capacity").notNull().default(1),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Weekly opening hours as wall-clock "HH:MM" in the company timezone.
// Multiple rows per weekday = split shifts (e.g. 11:00-15:00 and 18:00-23:00).
export const openingHours = pgTable("opening_hours", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  dayOfWeek: integer("day_of_week").notNull(), // 0=Sunday .. 6=Saturday
  openTime: text("open_time").notNull(), // "HH:MM"
  closeTime: text("close_time").notNull(), // "HH:MM"
});

// One-off closed days (holidays / maintenance) that block all slots.
export const closures = pgTable("closures", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  date: date("date").notNull(), // "YYYY-MM-DD"
  reason: text("reason"),
});

export const bookingStatusEnum = pgEnum("booking_status", ["confirmed", "cancelled"]);

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
    partySize: integer("party_size").notNull(),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    durationMin: integer("duration_min").notNull(),
    status: bookingStatusEnum("status").notNull().default("confirmed"),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Backstop against the exact-same-slot race; cancelled rows drop out so the slot frees.
    uniqueIndex("uniq_confirmed_slot")
      .on(t.resourceId, t.startAt)
      .where(sql`${t.status} = 'confirmed'`),
  ],
);

export type Company = typeof companies.$inferSelect;
export type User = typeof users.$inferSelect;
export type Resource = typeof resources.$inferSelect;
export type OpeningHour = typeof openingHours.$inferSelect;
export type Closure = typeof closures.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
