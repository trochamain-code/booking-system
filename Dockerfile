# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@11.9.0 --activate \
    && pnpm config set verify-deps-before-run false
WORKDIR /app

# --- install deps (layer cached on the lockfile) ---
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Cache-mount the pnpm store so retries reuse already-downloaded packages;
# bump fetch timeout/retries to ride out slow registry pulls.
# strict-dep-builds=false stops pnpm 11 from treating its dependency build-approval
# gate (esbuild/sharp/etc.) as a fatal error — we rebuild esbuild explicitly below.
# Unlike the old `|| true`, this does NOT mask real install failures (bad lockfile,
# network error, missing package), so a broken install still fails the build.
RUN --mount=type=cache,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm config set fetch-timeout 600000 && \
    pnpm config set fetch-retries 5 && \
    pnpm config set strict-dep-builds false && \
    pnpm install --frozen-lockfile && \
    pnpm rebuild esbuild

# --- build the Next app ---
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Placeholder so the DB client can construct at module load; pages are dynamic,
# so no database is actually contacted during the build.
ENV DATABASE_URL=postgres://build:build@localhost:5432/build
RUN pnpm build

# --- runtime: migrate, seed the super-admin, then serve ---
FROM base AS runner
ENV NODE_ENV=production
# Run as the unprivileged `node` user shipped in the base image; own the app dir so
# Next can write its runtime cache.
COPY --from=build --chown=node:node /app ./
USER node
EXPOSE 3000
# Probe the DB-backed health endpoint; container is unhealthy if the app can't serve.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Invoke the local binaries directly — no pnpm/corepack needed at runtime, which
# keeps the non-root user from having to resolve a global package manager.
CMD ["sh", "-c", "node_modules/.bin/drizzle-kit migrate && node_modules/.bin/tsx scripts/seed.ts && node_modules/.bin/next start"]
