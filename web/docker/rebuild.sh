#!/bin/sh
# Rebuild the Astro site and hot-swap Nginx's static files.
# Called by rebuild-webhook.js on POST /rebuild.
set -e

API_BASE="${API_BASE:-http://backend}"

echo "[rebuild] Building Astro site..."
cd /repo/web
API_BASE="${API_BASE}" pnpm build

echo "[rebuild] Syncing output to Nginx..."
# Nginx is live while this runs, so the served tree must never be empty: a
# `rm -rf` then `cp -r` would 404 every URL for the length of the copy (and
# leave nothing at all if the copy died — this has happened on a full disk).
# `cp -r` alone merges, so a page whose module was switched off would stay
# served until the container is recreated. rsync updates in place and drops
# only what the new build no longer has.
rsync -a --delete /repo/web/dist/ /usr/share/nginx/html/

echo "[rebuild] Done."
