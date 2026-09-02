#!/bin/sh
# Rebuild the Astro site and hot-swap Nginx's static files.
# Called by rebuild-webhook.js on POST /rebuild.
set -e

API_BASE="${API_BASE:-http://backend}"

echo "[rebuild] Building Astro site..."
cd /repo/web
API_BASE="${API_BASE}" pnpm build

echo "[rebuild] Copying output to Nginx..."
cp -r /repo/web/dist/* /usr/share/nginx/html/

echo "[rebuild] Done."
