# syntax=docker/dockerfile:1
# Multi-stage: deps → builder → runner (Next standalone) + migrate (Drizzle)

FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    python3 \
    make \
    g++ \
  && rm -rf /var/lib/apt/lists/*

# ---------------------------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json ./
# postinstall syncs OCR assets from node_modules; skip until full source is present
RUN npm ci --ignore-scripts

# ---------------------------------------------------------------------------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Client bundle inlines these at build time
ARG NEXT_PUBLIC_RAZORPAY_KEY_ID
ARG NEXT_PUBLIC_TINYMCE_API_KEY
ARG NEXT_PUBLIC_GTM_ID
ENV NEXT_PUBLIC_RAZORPAY_KEY_ID=$NEXT_PUBLIC_RAZORPAY_KEY_ID
ENV NEXT_PUBLIC_TINYMCE_API_KEY=$NEXT_PUBLIC_TINYMCE_API_KEY
ENV NEXT_PUBLIC_GTM_ID=$NEXT_PUBLIC_GTM_ID
# Page data collection needs DB at build time. Pass via BuildKit secret so the
# password is NOT inlined into image history / build logs (unlike ARG in RUN).
#   docker build --network=host --secret id=database_url,env=BUILD_DATABASE_URL ...
RUN --mount=type=secret,id=database_url \
  export DATABASE_URL="$(cat /run/secrets/database_url)" \
  && test -n "$DATABASE_URL" \
  && npm run build

# ---------------------------------------------------------------------------
# One-off / Jenkins: drizzle migrations against Docker Postgres
FROM base AS migrate
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json drizzle.config.ts tsconfig.json ./
COPY scripts ./scripts
# drizzle.config schema paths + SQL migrations / journal
COPY lib/db ./lib/db
CMD ["npm", "run", "db:migrate"]

# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "server.js"]
