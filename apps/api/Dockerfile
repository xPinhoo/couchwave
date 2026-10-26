# syntax=docker/dockerfile:1
# Build context is the repository root:  docker build -f apps/api/Dockerfile .

FROM node:24-slim AS base
WORKDIR /app
ENV TURBO_TELEMETRY_DISABLED=1

# 1. Keep only the API and the workspace packages it depends on
FROM base AS pruner
COPY . .
RUN npx --yes turbo@2.11.10 prune @couchwave/api --docker

# 2. Install dependencies first so this layer stays cached until a package.json or the
#    lockfile changes, then build and drop dev dependencies
FROM base AS builder
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/package-lock.json ./package-lock.json
RUN npm ci --no-audit --no-fund
COPY --from=pruner /app/out/full/ .
# turbo prune only copies workspaces, but every package extends this file
COPY tsconfig.base.json ./
RUN npx turbo run build --filter=@couchwave/api \
  && npm prune --omit=dev --no-audit --no-fund

# 3. Runtime image: production dependencies and compiled output only
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=builder --chown=node:node /app/package.json ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/packages ./packages
COPY --from=builder --chown=node:node /app/apps/api/package.json ./apps/api/
COPY --from=builder --chown=node:node /app/apps/api/dist ./apps/api/dist
USER node
EXPOSE 3000
# Lets Coolify (or plain Docker) know when the API is really up before routing traffic
# to it. The slim image has no curl, so use Node's built-in fetch.
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
# Node runs as PID 1 and receives SIGTERM directly; Nest's shutdown hooks close the
# HTTP server and sockets so redeploys stop cleanly
CMD ["node", "apps/api/dist/main.js"]
