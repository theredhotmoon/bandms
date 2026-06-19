# ── Stage 1: install deps ──────────────────────────────────────────────────
FROM node:22-alpine AS deps

RUN npm install -g pnpm@9

WORKDIR /app

COPY package.json ./
RUN pnpm install --no-frozen-lockfile

# ── Stage 2: serve ─────────────────────────────────────────────────────────
# Build happens at container startup (not image build time) so that the
# Astro SSG build can reach the backend API over Docker networking.
FROM node:22-alpine AS app

RUN apk add --no-cache nginx wget && \
    npm install -g pnpm@9 && \
    mkdir -p /usr/share/nginx/html /var/log/nginx /run/nginx

WORKDIR /app

# Copy deps and source
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Nginx + startup script
COPY docker/nginx.conf /etc/nginx/http.d/default.conf
COPY docker/start.sh   /start.sh
RUN sed -i 's/\r$//' /start.sh && chmod +x /start.sh

EXPOSE 80

CMD ["/start.sh"]
