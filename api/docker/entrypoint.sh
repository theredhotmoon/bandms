#!/bin/sh
set -e

cd /var/www/html

echo "[entrypoint] Waiting for MySQL..."
until php -r "
try {
    new PDO(
        'mysql:host=${DB_HOST:-mysql};port=${DB_PORT:-3306};dbname=${DB_DATABASE:-bandms}',
        '${DB_USERNAME:-bandms}',
        '${DB_PASSWORD:-secret}'
    );
} catch (Exception \$e) { exit(1); }
" 2>/dev/null; do
    sleep 2
done
echo "[entrypoint] MySQL ready."

# Cache config/routes for performance (reads env vars at build time)
php artisan optimize

# Run any pending migrations
php artisan migrate --force

# Generate Passport keys and default clients if not already present
php artisan passport:keys --no-interaction 2>/dev/null || true

CLIENT_COUNT=$(php -r "
try {
    \$pdo = new PDO('mysql:host=${DB_HOST:-mysql};port=${DB_PORT:-3306};dbname=${DB_DATABASE:-bandms}','${DB_USERNAME:-bandms}','${DB_PASSWORD:-secret}');
    echo \$pdo->query('SELECT COUNT(*) FROM oauth_clients')->fetchColumn();
} catch(Exception \$e){ echo 0; }
")
if [ "$CLIENT_COUNT" = "0" ]; then
    echo "[entrypoint] Creating Passport clients..."
    php artisan passport:client --personal --name="BandMS Personal" --no-interaction || true
    php artisan passport:client --password --name="BandMS Password" --no-interaction || true
fi

# Create public/storage symlink (harmless if already exists)
php artisan storage:link --force 2>/dev/null || true

# Ensure www-data owns the storage (important on fresh volume mounts)
chown -R www-data:www-data storage bootstrap/cache
chmod -R 775 storage bootstrap/cache
# Tighten key permissions AFTER the broad chmod so they aren't overwritten
chmod 600 storage/oauth-private.key storage/oauth-public.key 2>/dev/null || true

echo "[entrypoint] Starting services..."
exec supervisord -c /etc/supervisord.conf
