#!/bin/sh
set -e

# Seed .env with required placeholders so key:generate can write into it
printf 'APP_KEY=\nAPP_ENV=testing\n' > /var/www/html/.env

# Generate APP_KEY so encryption / session / hashing works in tests
php artisan key:generate --no-interaction

# Generate Passport OAuth keys so the service provider can boot
php artisan passport:keys --force --no-interaction 2>/dev/null || true

exec php -d pcov.enabled=1 artisan test "$@"
