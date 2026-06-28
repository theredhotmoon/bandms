# ── Stage 1: build ────────────────────────────────────────────
FROM node:22-alpine AS builder

RUN npm install -g npm@11.17.0

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

# Empty string → API calls become relative (/api/…), Nginx proxies them to backend
ARG VITE_API_URL=""
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build

# ── Stage 2: serve ────────────────────────────────────────────
FROM nginx:stable-alpine AS app

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
