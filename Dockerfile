# syntax=docker/dockerfile:1.7
# ─── Multi-stage production image for PomeloSMP ──────────────────────────────
# Stages:
#   1. deps    — install full (prod + dev) deps for building
#   2. build   — run astro check + build to produce ./dist
#   3. runtime — minimal image with prod deps only, runs as non-root, has healthcheck
#
# Target: ~180 MB final image, zero native-compile requirements (thanks to @libsql/client).

ARG NODE_VERSION=22

# ─── Stage 1: deps ───────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app

# Install build tools only for libsql's prebuilt downloader (no compile needed).
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json ./
RUN npm ci --no-fund --no-audit

# ─── Stage 2: build ──────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS build
WORKDIR /app

RUN apk add --no-cache libc6-compat

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# The build reads .env via --env-file-if-exists; at build time env doesn't need
# to be real because Astro SSR code is only *bundled* here, not executed. To
# satisfy the one import-time Zod check we pass a stub APP_SECRET via ARG/ENV.
ARG APP_SECRET=build-time-placeholder-at-least-32-characters-long-x
ENV APP_SECRET=${APP_SECRET}

RUN npm run build

# Drop dev deps, keep only what the runtime needs.
RUN npm prune --omit=dev

# ─── Stage 3: runtime ────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS runtime
WORKDIR /app

# `wget` is used by the HEALTHCHECK below.
RUN apk add --no-cache libc6-compat wget \
 && addgroup -S pomelo \
 && adduser -S pomelo -G pomelo -u 10001

# Copy only what the server needs to run.
COPY --from=build --chown=pomelo:pomelo /app/package.json ./package.json
COPY --from=build --chown=pomelo:pomelo /app/node_modules ./node_modules
COPY --from=build --chown=pomelo:pomelo /app/dist ./dist
COPY --from=build --chown=pomelo:pomelo /app/drizzle ./drizzle
COPY --from=build --chown=pomelo:pomelo /app/scripts ./scripts

# Data dir (SQLite) — owned by the non-root user so migrations can write.
RUN mkdir -p /app/data && chown -R pomelo:pomelo /app/data
VOLUME ["/app/data"]

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321
ENV DATABASE_URL=file:/app/data/pomelo.db

USER pomelo
EXPOSE 4321

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4321/api/health > /dev/null || exit 1

# Run migrations first, then start the Astro Node server.
CMD ["sh", "-c", "node scripts/migrate.mjs && node ./dist/server/entry.mjs"]
