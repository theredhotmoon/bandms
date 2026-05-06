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
if [ ! -f storage/oauth-private.key ]; then
    echo "[entrypoint] Installing Passport keys..."
    php artisan passport:install --no-interaction || true
fi

# Ensure www-data owns the storage (important on fresh volume mounts)
chown -R www-data:www-data storage bootstrap/cache
chmod -R 775 storage bootstrap/cache

echo "[entrypoint] Starting services..."
exec supervisord -c /etc/supervisord.conf
