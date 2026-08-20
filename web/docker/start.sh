#!/bin/sh
set -e

API_BASE="${API_BASE:-http://backend}"

echo "⏳  Waiting for API at ${API_BASE}/api/health …"
until wget -qO- "${API_BASE}/api/health" > /dev/null 2>&1; do
  sleep 2
done
echo "✅  API is ready."

echo "🔨  Building Astro site…"
API_BASE="${API_BASE}" pnpm build

echo "📋  Copying build output…"
cp -r /app/dist/* /usr/share/nginx/html/

echo "🚀  Starting rebuild webhook and Nginx…"
node /docker/rebuild-webhook.js &
exec nginx -g "daemon off;"
