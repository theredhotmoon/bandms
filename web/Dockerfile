# ── Stage 1: install deps ──────────────────────────────────────────────────
#
# Build context is the REPO ROOT, not web/ — see docker-compose.yml and
# .github/workflows/deploy.yml. The public site imports @bandms/rider-core from
# packages/ to render a published tech rider, so a context scoped to web/
# physically cannot see its own dependency. Paths below are repo-relative.
FROM node:22-alpine AS deps

# pnpm 11, not 9: the workspace links @bandms/rider-core with the `workspace:*`
# protocol and installs from one root lockfile. pnpm 9 predates the
# `allowBuilds` key this workspace uses to let sharp run its postinstall.
RUN npm install -g pnpm@11

WORKDIR /repo

# Manifests first so a source-only change does not re-run the install layer.
# All three members are copied because --frozen-lockfile validates the lockfile
# against the whole workspace, even when the filter narrows what gets built.
COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY app/package.json                  app/package.json
COPY web/package.json                  web/package.json
COPY packages/rider-core/package.json  packages/rider-core/package.json
RUN pnpm install --frozen-lockfile --filter bandms-web...

# ── Stage 2: serve ─────────────────────────────────────────────────────────
# Build happens at container startup (not image build time) so that the
# Astro SSG build can reach the backend API over Docker networking.
FROM node:22-alpine AS app

RUN apk add --no-cache nginx wget && \
    npm install -g pnpm@11 && \
    mkdir -p /usr/share/nginx/html /var/log/nginx /run/nginx

WORKDIR /repo

# Deps, then the workspace definition and every source tree the build reads.
# start.sh runs `pnpm build` from /repo/web, which resolves @bandms/rider-core
# through the root node_modules link — so packages/ must be present at runtime,
# not just at install time.
COPY --from=deps /repo/node_modules      ./node_modules
COPY --from=deps /repo/web/node_modules  ./web/node_modules
COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/ packages/
COPY web/      web/

# Nginx + startup scripts
COPY web/docker/nginx.conf           /etc/nginx/http.d/default.conf
COPY web/docker/start.sh             /start.sh
COPY web/docker/rebuild-webhook.js   /docker/rebuild-webhook.js
COPY web/docker/rebuild.sh           /docker/rebuild.sh
RUN sed -i 's/\r$//' /start.sh /docker/rebuild.sh && \
    chmod +x /start.sh /docker/rebuild.sh

EXPOSE 80

CMD ["/start.sh"]
