#!/bin/sh
set -e

# An empty .env prevents PHP file_get_contents warnings from Dotenv
touch /var/www/html/.env

# Generate Passport OAuth keys so the service provider can boot
php artisan passport:keys --force --no-interaction 2>/dev/null || true

exec php artisan test "$@"
