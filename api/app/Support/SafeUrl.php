<?php

declare(strict_types=1);

namespace App\Support;

final class SafeUrl
{
    private const BLOCKED_HOSTS = [
        'localhost',
        'web',
        'backend',
        'mysql',
        'redis',
        'caddy',
        'frontend',
        'mailpit',
    ];

    public static function isAllowed(string $url): bool
    {
        $parsed = parse_url($url);
        if (! is_array($parsed)) {
            return false;
        }

        $scheme = strtolower((string) ($parsed['scheme'] ?? ''));
        if (! in_array($scheme, ['http', 'https'], true)) {
            return false;
        }

        $host = strtolower(trim((string) ($parsed['host'] ?? ''), '[]'));
        if ($host === '') {
            return false;
        }

        if (
            in_array($host, self::BLOCKED_HOSTS, true)
            || str_ends_with($host, '.local')
            || str_ends_with($host, '.internal')
            || str_ends_with($host, '.localhost')
        ) {
            return false;
        }

        if (filter_var($host, FILTER_VALIDATE_IP) !== false) {
            return filter_var(
                $host,
                FILTER_VALIDATE_IP,
                FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE
            ) !== false;
        }

        if (! app()->environment('testing')) {
            $ips = @gethostbynamel($host);
            if (is_array($ips)) {
                foreach ($ips as $ip) {
                    if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false) {
                        return false;
                    }
                }
            }
        }

        return true;
    }
}
