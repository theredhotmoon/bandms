# ── Stage 1: build ────────────────────────────────────────────
#
# Build context is the REPO ROOT, not app/ — see docker-compose.yml and
# .github/workflows/deploy.yml. The SPA imports @bandms/rider-core from
# packages/, so a context scoped to app/ physically cannot see its own
# dependency. Paths below are therefore repo-relative.
FROM node:22-alpine AS builder

# pnpm, not npm: the workspace links @bandms/rider-core with the `workspace:*`
# protocol, which npm does not understand and would try to fetch from the
# registry. Pinned to the major the root lockfile was written by.
RUN npm install -g pnpm@11

WORKDIR /repo

# Manifests first so a source-only change does not re-run the install layer.
# All three members are copied because --frozen-lockfile validates the lockfile
# against the whole workspace, even when the filter narrows what gets built.
COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY app/package.json                  app/package.json
COPY web/package.json                  web/package.json
COPY packages/rider-core/package.json  packages/rider-core/package.json
RUN pnpm install --frozen-lockfile --filter exp-01...

COPY packages/ packages/
COPY app/      app/

WORKDIR /repo/app

# Empty string → API calls become relative (/api/…), Nginx proxies them to backend
ARG VITE_API_URL=""
ENV VITE_API_URL=${VITE_API_URL}

# CARTO basemap key for the venue map in the admin. Unset simply leaves the
# tiles watermarked. See web/src/lib/basemap.ts for the full story.
ARG VITE_CARTO_KEY=""
ENV VITE_CARTO_KEY=${VITE_CARTO_KEY}

# The path segment the whole admin panel sits behind. Empty falls back to
# 'admin' in app/src/config/admin.ts, which reproduces the historical URLs
# exactly — so an unset value is the safe default, not a broken build.
#
# This is baked into the bundle here, at image build time. Changing the admin
# path in .env therefore needs `docker compose build frontend`; recreating the
# container is not enough. Caddy reads the same value at runtime, so the two
# only agree after a rebuild.
ARG VITE_ADMIN_PATH=""
ENV VITE_ADMIN_PATH=${VITE_ADMIN_PATH}

RUN pnpm build

# ── Stage 2: serve ────────────────────────────────────────────
FROM nginx:stable-alpine AS app

COPY app/docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /repo/app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
