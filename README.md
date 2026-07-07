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

## Public URL via Cloudflare Tunnel
The `cloudflared` service in `docker-compose.yml` publishes the app at
**https://booking.host-ia.online** — no host port is exposed; Cloudflare's edge
tunnels traffic straight to the `app` container over the compose network.

- Tunnel: `booking-system` (`8a44a94a-dc8b-405c-b6a8-0262d6561c21`), config in `cloudflared/config.yml`.
- Credentials live in `cloudflared/tunnel-credentials.json` (git-ignored — keep it secret).
- `APP_URL` is set to the public HTTPS URL so email links and the embed snippet use it.

Recreate the tunnel on another account/zone:
```bash
cloudflared tunnel create booking-system
cloudflared tunnel route dns <TUNNEL_ID> booking.<your-zone>
# copy ~/.cloudflared/<TUNNEL_ID>.json to cloudflared/tunnel-credentials.json
# and update the id/hostname in cloudflared/config.yml
```

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
| `pnpm test` | unit tests: availability engine, session token, password, validation, pg-error, slug |
| `pnpm db:generate` / `db:migrate` | Drizzle migrations |
| `pnpm seed` / `pnpm seed:demo` | seed super-admin / demo company |

## Production hardening
- **No double-booking** — a Postgres `EXCLUDE USING gist` constraint (`no_overlap_confirmed`, migration `0004`) makes overlapping confirmed bookings on the same resource impossible at the DB level, closing the availability re-check race. The app maps the violation to a friendly "slot taken" message.
- **Auth** — HMAC signed-cookie sessions (httpOnly/secure/lax); scrypt runs async off the event loop; login is rate-limited and constant-time against user enumeration. In production the app refuses to boot if `AUTH_SECRET` is missing, the dev default, or shorter than 32 bytes.
- **Input validation** — every server action validates and bounds its input (email, hex color, http(s) logo URL, IANA timezone, UUIDs, party size, field lengths); the create-booking flow rejects past slots.
- **Security headers** — `X-Frame-Options: DENY` + `frame-ancestors 'none'` everywhere except the intentionally-embeddable `/embed` widget, plus HSTS, `nosniff`, `Referrer-Policy`, and `Permissions-Policy`.
- **Ops** — DB-backed health probe at `GET /api/health` (wired into Docker/compose healthchecks); FK/hot-path indexes and `CHECK` constraints across the schema.

## The interesting bit
`src/lib/availability.ts` — a pure function turning opening hours + resources + existing bookings
into free slots for a party size, auto-assigning the smallest fitting resource, timezone-correct via
`Intl` (no date library). Tested in `src/lib/availability.test.ts`.

## Env (`.env`)
`DATABASE_URL`, `AUTH_SECRET` required (in production `AUTH_SECRET` must be a real 32+ byte secret — the app will not start otherwise). `RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL` optional.
