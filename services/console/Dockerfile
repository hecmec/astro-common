# Admin console. Build from the repository root:
#   docker build -f services/console/Dockerfile -t bc-console .
# Astro server build on Node 26 LTS; the runtime image keeps production dependencies only.

FROM node:26-alpine AS base
# Corepack is no longer shipped with Node 25+: install the pinned pnpm.
RUN npm install -g pnpm@12.18.0 && npm cache clean --force
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY services/comments/package.json services/comments/
COPY services/console/package.json services/console/
COPY packages/comments-widget/package.json packages/comments-widget/
COPY packages/astro-comments/package.json packages/astro-comments/
COPY packages/google-auth/package.json packages/google-auth/

# Build (needs the dev dependencies: Tailwind, the Astro checker is not run here)
FROM base AS build
RUN pnpm install --frozen-lockfile --filter @babelcoach/console...
COPY packages/google-auth packages/google-auth
COPY services/console services/console
RUN pnpm --filter @babelcoach/console run build

# Runtime dependencies only. The lockfile is frozen and pnpm-workspace.yaml keeps the
# 7-day minimum release age and the install-script allowlist.
FROM base AS deps
RUN pnpm install --frozen-lockfile --prod --filter @babelcoach/console

FROM node:26-alpine
# HOST '::' listens on IPv6 and IPv4: in the image "localhost" is ::1 (Coolify's health check).
ENV NODE_ENV=production PORT=4340 HOST=::
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/services/console/node_modules ./services/console/node_modules
COPY services/console/package.json services/console/
COPY --from=build /app/services/console/dist services/console/dist
USER node
EXPOSE 4340
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:4340/healthz || exit 1
WORKDIR /app/services/console
CMD ["node", "dist/server/entry.mjs"]
