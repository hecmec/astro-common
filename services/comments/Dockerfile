# Comments service. Build from the repository root:
#   docker build -f services/comments/Dockerfile -t bc-comments .
# Node 26 LTS; TypeScript runs directly (type stripping), no transpile step.

FROM node:26-alpine AS base
# Corepack is no longer shipped with Node 25+: install the pinned pnpm.
RUN npm install -g pnpm@12.18.0 && npm cache clean --force
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY services/comments/package.json services/comments/
COPY packages/comments-widget/package.json packages/comments-widget/
COPY packages/astro-comments/package.json packages/astro-comments/
COPY packages/google-auth/package.json packages/google-auth/

# Widget bundle (needs esbuild, a dev dependency)
FROM base AS widget
RUN pnpm install --frozen-lockfile --filter @babelcoach/comments-widget
COPY packages/comments-widget packages/comments-widget
RUN pnpm --filter @babelcoach/comments-widget run build

# Runtime dependencies only. The lockfile is frozen and pnpm-workspace.yaml keeps the
# 7-day minimum release age and the install-script allowlist.
FROM base AS deps
RUN pnpm install --frozen-lockfile --prod --filter @babelcoach/comments-service

FROM node:26-alpine
ENV NODE_ENV=production PORT=4330 DATABASE_PATH=/data/comments.db
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/services/comments/node_modules ./services/comments/node_modules
COPY services/comments/package.json services/comments/sites.yaml services/comments/
COPY packages/google-auth/package.json packages/google-auth/
COPY packages/google-auth/src packages/google-auth/src
COPY services/comments/src services/comments/src
COPY services/comments/public services/comments/public
COPY --from=widget /app/services/comments/public/widget.js services/comments/public/widget.js
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 4330
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:4330/healthz || exit 1
WORKDIR /app/services/comments
CMD ["node", "src/server.ts"]
