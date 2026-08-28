# ── Stage 1: build ────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

# Empty string → API calls become relative (/api/…), Nginx proxies them to backend
ARG VITE_API_URL=""
ENV VITE_API_URL=${VITE_API_URL}

# CARTO basemap key for the map on the SPA's /concerts view. Dev-only in
# practice: in production Caddy's @spa matcher does not route /concerts here, so
# that view never reaches a visitor and CI passes no value. Unset simply leaves
# the tiles watermarked. See web/src/lib/basemap.ts for the full story.
ARG VITE_CARTO_KEY=""
ENV VITE_CARTO_KEY=${VITE_CARTO_KEY}

RUN npm run build

# ── Stage 2: serve ────────────────────────────────────────────
FROM nginx:stable-alpine AS app

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
