# ── Stage 1: prod PHP dependencies (no dev) ───────────────────
FROM composer:2 AS vendor

WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install \
    --no-dev \
    --no-interaction \
    --no-scripts \
    --no-autoloader \
    --prefer-source

COPY . .
RUN composer dump-autoload --optimize --classmap-authoritative

# ── Stage 2: dev+prod PHP dependencies ────────────────────────
FROM composer:2 AS vendor-dev

WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install \
    --no-interaction \
    --no-scripts \
    --no-autoloader \
    --prefer-source

COPY . .
RUN composer dump-autoload --optimize

# ── Stage 2: production image ─────────────────────────────────
FROM php:8.4-fpm-alpine AS app

RUN apk add --no-cache \
        nginx \
        supervisor \
        curl \
        libxml2-dev \
        oniguruma-dev \
    && docker-php-ext-install \
        pdo_mysql \
        bcmath \
        opcache \
        pcntl \
    && rm -rf /var/cache/apk/*

COPY docker/php.ini "$PHP_INI_DIR/conf.d/app.ini"

WORKDIR /var/www/html

COPY --from=vendor /app/vendor ./vendor
COPY . .

RUN mkdir -p storage/framework/{sessions,views,cache} \
             storage/logs \
             storage/app/public \
    && chown -R www-data:www-data storage bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache

COPY docker/nginx.conf       /etc/nginx/http.d/default.conf
COPY docker/supervisord.conf /etc/supervisord.conf
COPY docker/entrypoint.sh    /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80
ENTRYPOINT ["/entrypoint.sh"]

# ── Stage 4: test image (dev deps, php-cli entrypoint) ────────
FROM app AS test
RUN apk add --no-cache sqlite-dev $PHPIZE_DEPS \
    && (pecl install pcov && docker-php-ext-enable pcov || echo "pcov unavailable, skipping coverage") \
    && apk del $PHPIZE_DEPS \
    && rm -rf /var/cache/apk/* /tmp/pear
COPY --from=vendor-dev /app/vendor ./vendor
COPY docker/test-entrypoint.sh /test-entrypoint.sh
RUN chmod +x /test-entrypoint.sh
ENTRYPOINT ["/test-entrypoint.sh"]
