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
RUN --mount=type=cache,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm config set fetch-timeout 600000 && \
    pnpm config set fetch-retries 5 && \
    { pnpm install --frozen-lockfile || true; } && \
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
COPY --from=build /app ./
EXPOSE 3000
CMD ["sh", "-c", "pnpm db:migrate && pnpm seed && pnpm start"]
