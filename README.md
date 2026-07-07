# Booking System

Multi-tenant booking SaaS for any capacity-based business (restaurants, salons, courts, clinics).
Companies manage bookable resources + opening hours; customers book a day/time through an
embeddable iframe widget and get an email confirmation. Customers never need an account.

Single Next.js app + Postgres. No separate backend. See `PLAN.md` for the full plan and the
deferred-features list.

## Stack
- Next.js 16 (App Router, server actions) + Tailwind
- Postgres + Drizzle ORM
- Auth: hand-rolled signed-cookie sessions + scrypt (Node `crypto`, no external auth lib)
- Email: Resend via `fetch` (optional; logs to console without a key)

## Run with Docker (db + app)
```bash
docker compose up --build        # builds the app, starts Postgres + app
```
The app comes up on http://localhost:3000; database migrations and the super-admin seed run
automatically at startup. Load the demo restaurant with:
```bash
docker compose exec app pnpm seed:demo   # Bistró Demo + owner@demo.com / password123
```
- Different port: `APP_PORT=3001 docker compose up --build` (also set `APP_URL` to match).
- Production: set a real secret — `export AUTH_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))")` — and optionally `RESEND_API_KEY` / `EMAIL_FROM` for real emails.

## Local dev
```bash
docker compose up -d db          # just Postgres
pnpm install
pnpm db:migrate                  # create tables
pnpm seed                        # super-admin: admin@example.com / admin1234
pnpm seed:demo                   # Bistró Demo + owner@demo.com / password123
pnpm dev
```

- Super admin → http://localhost:3000/ (creates companies + owners)
- Company dashboard → sign in as an owner (resources, hours, bookings, branding)
- Public widget → http://localhost:3000/embed/demo-bistro

Embed anywhere:
```html
<iframe src="http://localhost:3000/embed/demo-bistro" width="100%" height="700" style="border:0"></iframe>
```

## Roles
- **super_admin** — provisions companies + owners (`/admin`)
- **owner / staff** — manage one company (`/dashboard`)
- **customer** — anonymous; books via the widget, cancels via a tokened link

## Scripts
| Command | Does |
|---|---|
| `pnpm dev` / `pnpm build` | run / build |
| `pnpm test` | availability engine + slug unit tests |
| `pnpm db:generate` / `db:migrate` | Drizzle migrations |
| `pnpm seed` / `pnpm seed:demo` | seed super-admin / demo company |

## The interesting bit
`src/lib/availability.ts` — a pure function turning opening hours + resources + existing bookings
into free slots for a party size, auto-assigning the smallest fitting resource, timezone-correct via
`Intl` (no date library). Tested in `src/lib/availability.test.ts`.

## Env (`.env`)
`DATABASE_URL`, `AUTH_SECRET` required. `RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL` optional.
