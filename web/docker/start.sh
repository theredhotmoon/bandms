#!/bin/sh
set -e

API_BASE="${API_BASE:-http://backend}"

echo "⏳  Waiting for API at ${API_BASE}/api/health …"
until wget -qO- "${API_BASE}/api/health" > /dev/null 2>&1; do
  sleep 2
done
echo "✅  API is ready."

echo "🔨  Building Astro site…"
# PUBLIC_THEME selects the theme baked into this build, PUBLIC_CARTO_KEY
# unlocks the map tiles. Astro only exposes PUBLIC_-prefixed vars to
# import.meta.env, so the names matter. Both are inlined into the client JS at
# build time, which is why a key change needs a rebuild and not just a restart.
API_BASE="${API_BASE}" \
  PUBLIC_THEME="${PUBLIC_THEME:-}" \
  PUBLIC_CARTO_KEY="${PUBLIC_CARTO_KEY:-}" \
  pnpm build

echo "📋  Copying build output…"
# Clear first. `cp -r` merges, so a page whose module was switched off stays
# served from the previous build — the exact opposite of the guarantee the
# module system rests on ("a disabled module unbuilds its pages"). `docker
# compose restart` reuses the container filesystem, so this directory
# accumulates across runs; only a force-recreate started clean.
rm -rf /usr/share/nginx/html/*
cp -r /app/dist/* /usr/share/nginx/html/

echo "🚀  Starting rebuild webhook and Nginx…"
node /docker/rebuild-webhook.js &
exec nginx -g "daemon off;"
