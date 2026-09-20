#!/bin/sh
# Rebuild the Astro site and hot-swap Nginx's static files.
# Called by rebuild-webhook.js on POST /rebuild.
set -e

API_BASE="${API_BASE:-http://backend}"

echo "[rebuild] Building Astro site..."
cd /repo/web
API_BASE="${API_BASE}" pnpm build

echo "[rebuild] Copying output to Nginx..."
# Clear first, as start.sh does. `cp -r` merges, so a page whose module was
# switched off would otherwise stay served until the container is recreated.
rm -rf /usr/share/nginx/html/*
cp -r /repo/web/dist/* /usr/share/nginx/html/

echo "[rebuild] Done."
