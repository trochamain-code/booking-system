# Implementation Plan: Multi-tenant Booking System

## Overview
A multi-tenant booking SaaS where any company (restaurant, salon, court, clinic…) manages
bookable resources and opening hours, and customers book a day+time through an embeddable
iframe widget and get an email confirmation. Customers never need an account. Three actors:
super-admin (platform), company owner/staff (dashboard), customer (public widget).

The single interesting piece of logic is the **availability engine**: opening hours + resources
+ existing bookings → free slots for a given party size, with automatic resource assignment.
Everything else is CRUD + email.

## Architecture Decisions (ponytail: laziest thing that holds)
- **One Next.js app**, not Next + separate Go backend. API routes + server actions cover it.
  Add a separate service only when a single app measurably can't keep up. *(the earlier plan's
  Go/Fiber + Redis + Temporal + ClickHouse + Traefik + MinIO + WebSockets is all deferred — none
  of it is needed to take a booking.)*
- **Postgres, single database, `companyId` column on every tenant-scoped row.** No schema-per-tenant,
  no row-level-security engine. Every query filters by `companyId`. Add RLS/isolation when a real
  tenant demands it. `ponytail: shared DB, add RLS if a tenant contract requires hard isolation`
- **Drizzle** for schema+queries (typed, thin, no heavy runtime). Prisma is fine too — pick one.
- **Auth.js (credentials)** for staff/admin only. Customers are anonymous; their cancel/reschedule
  link carries an unguessable token. No customer accounts, no OAuth in v1.
- **Iframe embed only** (`/embed/[slug]`), no `widget.js` React injector. `<iframe>` is one line and
  does everything a v1 needs. Add the script-injector when a customer needs inline (non-iframe) embed.
- **Email via Resend.** No SMS/WhatsApp in v1.
- **Reminders via one daily cron route**, not Temporal. Deferred out of MVP entirely (see below).
- Resource is **generic**: `{ name, capacity }`. Restaurant table = capacity seats; salon chair /
  court / room = capacity 1. This is what makes it "any kind of company" with zero special-casing.

## Data Model (v1)
- `Company` — slug, name, timezone, logoUrl, primaryColor, slotIntervalMin, defaultDurationMin
- `User` — email, passwordHash, role (`super_admin` | `owner` | `staff`), companyId (null for super_admin)
- `Resource` — companyId, name, capacity, active
- `OpeningHour` — companyId, dayOfWeek (0-6), openTime, closeTime  *(multiple rows per day = split shifts)*
- `Closure` — companyId, date, reason  *(blocks a whole day: holidays/maintenance)*
- `Booking` — companyId, resourceId, customerName, email, phone, partySize, startAt, durationMin,
  status (`confirmed` | `cancelled`), token

---

## Task List

### Phase 0: Foundation

## Task 1: Scaffold app + DB + auth
**Description:** Create the Next.js app (pnpm), wire Postgres + Drizzle, define `Company` and `User`
schema + migration, set up Auth.js credentials login and role-aware session.

**Acceptance criteria:**
- [ ] `pnpm dev` serves the app; `/login` renders
- [ ] Migration creates `company` + `user` tables
- [ ] A seeded super-admin can log in and reach a placeholder `/admin`

**Verification:**
- [ ] Build: `pnpm build`
- [ ] Manual: log in as seeded super-admin, wrong password is rejected

**Dependencies:** None
**Files likely touched:** `app/login`, `lib/db.ts`, `lib/schema.ts`, `lib/auth.ts`, `drizzle/`
**Scope:** M

## Task 2: Super-admin creates a company + owner
**Description:** Super-admin form to create a company (name → slug, timezone) and its first owner user.
Owner can then log in and land on an empty company dashboard.

**Acceptance criteria:**
- [ ] Super-admin can create a company and an owner in one flow
- [ ] Owner logs in, sees `/dashboard` scoped to their company only
- [ ] Slug is unique and URL-safe

**Verification:**
- [ ] Manual: create 2 companies, confirm owner A cannot see company B's dashboard
**Dependencies:** Task 1
**Files likely touched:** `app/admin/companies`, `app/dashboard`, `lib/schema.ts`
**Scope:** M

### Checkpoint: Foundation
- [ ] Build clean, both roles log in, tenant scoping proven with 2 companies

### Phase 1: Company setup

## Task 3: Resource CRUD
**Description:** Company owner manages bookable resources (name + capacity + active toggle).

**Acceptance criteria:**
- [ ] Owner can add / edit / deactivate resources
- [ ] All queries filtered by `companyId`
**Verification:**
- [ ] Manual: add tables of capacity 2/4/6, deactivate one, it stops appearing in availability later
**Dependencies:** Task 2
**Files likely touched:** `app/dashboard/resources`, `lib/schema.ts`
**Scope:** S

## Task 4: Opening hours + closures
**Description:** Owner sets weekly opening hours (multiple ranges/day) and one-off closures.

**Acceptance criteria:**
- [ ] Owner sets per-day open/close ranges; supports split shifts (e.g. 11–15, 18–23)
- [ ] Owner adds a closure date that blocks all slots that day
**Verification:**
- [ ] Manual: set hours, add a closure, confirm both reflected by the engine in Task 5
**Dependencies:** Task 2
**Files likely touched:** `app/dashboard/hours`, `lib/schema.ts`
**Scope:** M

### Phase 2: Booking core (the actual value)

## Task 5: Availability engine (pure function) + test
**Description:** Pure function: `(company, date, partySize, resources, hours, closures, bookings) → slots[]`.
Generate candidate start times from opening hours at `slotIntervalMin`; for each, a slot is available if
some active resource with `capacity >= partySize` has no overlapping booking for `defaultDurationMin`.
Return each open slot with the resource it would auto-assign (smallest fitting resource).

**Acceptance criteria:**
- [ ] Returns no slots on a closure date or a day with no hours
- [ ] A slot disappears once its only fitting resource is booked for an overlapping window
- [ ] Auto-assigns the smallest resource that fits the party
**Verification:**
- [ ] `pnpm test` — engine unit test (closure, overlap, capacity-fit, split-shift cases) passes
**Dependencies:** Task 3, Task 4
**Files likely touched:** `lib/availability.ts`, `lib/availability.test.ts`
**Scope:** M — *this is the one piece that gets a real test (ponytail: non-trivial logic ships its check)*

## Task 6: Public embed page — pick party + date → slots
**Description:** Frameable `/embed/[slug]` route (CSP `frame-ancestors *`) applying company branding.
Customer picks party size and date (`<input type="date">`, native), sees available slots from Task 5.

**Acceptance criteria:**
- [ ] Loads inside a third-party `<iframe>` (no X-Frame-Options block)
- [ ] Shows only real available slots for the chosen party/date
- [ ] Uses company logo + primary color
**Verification:**
- [ ] Manual: embed the URL in a scratch HTML file, book flow renders and lists slots
**Dependencies:** Task 5
**Files likely touched:** `app/embed/[slug]`, `middleware.ts` (CSP), `lib/branding.ts`
**Scope:** M

## Task 7: Create booking + confirmation email + cancel link
**Description:** Customer submits name/email/phone for a slot → booking created (resource auto-assigned,
re-checked at write time to avoid races), confirmation email sent via Resend with a tokened cancel link.
Cancel link sets status = cancelled and frees the slot.

**Acceptance criteria:**
- [ ] Booking persists with an assigned resource; double-booking the same resource/time is rejected
- [ ] Confirmation email arrives with correct details + working cancel link
- [ ] Cancel link cancels and the slot reopens in availability
**Verification:**
- [ ] Manual: book, receive email, cancel via link, confirm slot returns
- [ ] `pnpm test` — write-time conflict guard test
**Dependencies:** Task 6
**Files likely touched:** `app/embed/[slug]/book`, `app/cancel/[token]`, `lib/email.ts`
**Scope:** M

### Checkpoint: Core loop works end-to-end
- [ ] Anonymous customer books through an iframe and gets a confirmation email
- [ ] Overlapping/over-capacity bookings are refused
- [ ] Review with human before Phase 3

### Phase 3: Company operations

## Task 8: Dashboard booking list (day view) + cancel
**Description:** Owner/staff see bookings for a selected day (time-ordered, with resource + party),
and can cancel one.

**Acceptance criteria:**
- [ ] Day view lists that company's bookings only
- [ ] Staff cancel frees the slot and (optional) emails the customer
**Verification:**
- [ ] Manual: booking made in Task 7 appears here; cancel reopens the slot
**Dependencies:** Task 7
**Files likely touched:** `app/dashboard/bookings`
**Scope:** S

## Task 9: Branding + copy-paste embed snippet
**Description:** Owner sets logo URL + primary color and copies the ready-made `<iframe>` snippet.

**Acceptance criteria:**
- [ ] Branding changes reflect on `/embed/[slug]`
- [ ] Dashboard shows the exact `<iframe src=".../embed/slug" …>` snippet to copy
**Verification:**
- [ ] Manual: change color, reload embed, snippet pastes into a test page and works
**Dependencies:** Task 6
**Files likely touched:** `app/dashboard/settings`
**Scope:** S

### Checkpoint: MVP complete
- [ ] All acceptance criteria met; one super-admin, ≥1 company, working public embed, live bookings

---

## Deferred (explicitly out of MVP — add when the trigger below fires)
| Feature | Add when |
|---|---|
| Reminders 24h/2h (daily cron route) | first real customer complains about no-shows |
| Waitlist / walk-ins / QR check-in | a live venue asks for it |
| SMS / WhatsApp notifications | email proves insufficient; Twilio/WA account exists |
| Stripe subscription billing | you have a paying company to charge |
| Public API + API keys | a company wants to integrate their own site |
| Analytics (occupancy, no-show rate) | there's enough booking volume to analyze |
| Staff sub-roles (hostess/manager/…) | a company needs >1 permission tier |
| `widget.js` inline injector | a customer can't use an iframe |
| AI phone/chat agent, forecasting | core product is validated and monetized |
| Calendar sync (Google/Outlook/Apple) | a company asks to see bookings in their calendar |
| Redis / Temporal / ClickHouse / separate Go service | a single Next+Postgres app measurably can't cope |

## Risks and Mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| Double-booking under concurrency | High | Re-check availability inside the write, unique constraint on (resourceId, startAt) |
| Timezone bugs in slot generation | High | Store UTC, do slot math in the company's timezone explicitly, test split-shift + DST |
| Tenant data leak (missing companyId filter) | High | Single query helper that always injects companyId; test with 2 companies at every checkpoint |
| Email deliverability | Med | Resend with a verified domain; booking still succeeds if email fails (queue/log, don't block) |

## Open Questions
1. **Stack**: single Next.js app (recommended, lazy) or the Next + Go backend you described earlier?
2. **Slot duration**: fixed per company (v1) or per-service (e.g. lunch 90m / dinner 120m)? v1 assumes fixed.
3. **Who creates companies**: self-serve signup, or super-admin provisions them (v1 assumes super-admin)?
