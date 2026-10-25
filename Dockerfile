FROM node:24-bookworm-slim AS build
ENV COREPACK_HOME=/opt/corepack
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm db:generate
ENV NEXT_TELEMETRY_DISABLED=1 TURBO_TELEMETRY_DISABLED=1
RUN DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build AUTH_SECRET=build-only-placeholder-not-a-runtime-secret APP_URL=http://127.0.0.1:3000 AUTH_URL=http://127.0.0.1:3000 pnpm build --env-mode=loose

FROM node:24-bookworm-slim AS runtime
ENV COREPACK_HOME=/opt/corepack
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /app
COPY --from=build --chown=node:node /app /app
RUN mkdir -p /app/uploads && chown node:node /app/uploads
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "scripts/start-production.mjs"]
