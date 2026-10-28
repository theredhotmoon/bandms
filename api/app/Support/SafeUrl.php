<?php

declare(strict_types=1);

namespace App\Support;

use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

/**
 * Outbound fetches of URLs the band typed in (member iCal feeds, press
 * release links). Checking the hostname is not enough on its own: the HTTP
 * client would resolve the name again, so a record that answers a public IP
 * to the check and 127.0.0.1 to the fetch (DNS rebinding) walks straight
 * past it, and so does a public URL that redirects somewhere internal.
 * get() therefore resolves once, rejects the request if any address is
 * private, pins curl to the addresses it checked, and follows redirects
 * itself so every hop is checked the same way.
 */
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

    private const MAX_REDIRECTS = 3;

    public static function isAllowed(string $url): bool
    {
        return self::resolve($url) !== null;
    }

    /**
     * GET a band-supplied URL, or null when it (or a redirect hop) points
     * anywhere that is not a public http(s) address.
     *
     * @param  array<string, string>  $headers
     */
    public static function get(string $url, int $timeout, array $headers = []): ?Response
    {
        for ($hop = 0; $hop <= self::MAX_REDIRECTS; $hop++) {
            $target = self::resolve($url);
            if ($target === null) {
                return null;
            }

            $options = ['allow_redirects' => false];
            if ($target['ips'] !== []) {
                $options['curl'] = [CURLOPT_RESOLVE => array_map(
                    fn (string $ip) => "{$target['host']}:{$target['port']}:" . (str_contains($ip, ':') ? "[{$ip}]" : $ip),
                    $target['ips'],
                )];
            }

            $response = Http::withHeaders($headers)->withOptions($options)->timeout($timeout)->get($url);

            if (! $response->redirect()) {
                return $response;
            }

            $location = $response->header('Location');
            if ($location === '') {
                return $response;
            }
            $url = self::absolutise($location, $url);
        }

        return null;
    }

    /**
     * @return array{host: string, port: int, ips: list<string>}|null
     */
    private static function resolve(string $url): ?array
    {
        $parsed = parse_url($url);
        if (! is_array($parsed)) {
            return null;
        }

        $scheme = strtolower((string) ($parsed['scheme'] ?? ''));
        if (! in_array($scheme, ['http', 'https'], true)) {
            return null;
        }

        $host = strtolower(trim((string) ($parsed['host'] ?? ''), '[]'));
        if ($host === '') {
            return null;
        }

        if (
            in_array($host, self::BLOCKED_HOSTS, true)
            || str_ends_with($host, '.local')
            || str_ends_with($host, '.internal')
            || str_ends_with($host, '.localhost')
        ) {
            return null;
        }

        $port = (int) ($parsed['port'] ?? ($scheme === 'https' ? 443 : 80));

        if (filter_var($host, FILTER_VALIDATE_IP) !== false) {
            return self::isPublicIp($host) ? ['host' => $host, 'port' => $port, 'ips' => []] : null;
        }

        // Tests fake the HTTP client and must not touch real DNS.
        if (app()->environment('testing')) {
            return ['host' => $host, 'port' => $port, 'ips' => []];
        }

        $ips = self::lookup($host);
        if ($ips === []) {
            return null;   // fail closed: an unresolvable host is not "allowed"
        }
        foreach ($ips as $ip) {
            if (! self::isPublicIp($ip)) {
                return null;
            }
        }

        return ['host' => $host, 'port' => $port, 'ips' => $ips];
    }

    /** @return list<string> */
    private static function lookup(string $host): array
    {
        $records = @dns_get_record($host, DNS_A | DNS_AAAA);
        if (! is_array($records)) {
            return [];
        }

        $ips = [];
        foreach ($records as $record) {
            $ip = $record['ip'] ?? $record['ipv6'] ?? null;
            if (is_string($ip) && $ip !== '') {
                $ips[] = $ip;
            }
        }

        return array_values(array_unique($ips));
    }

    private static function isPublicIp(string $ip): bool
    {
        // ::ffff:10.0.0.1 is 10.0.0.1 on the wire; judge the IPv4 inside it.
        if (preg_match('/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i', $ip, $m) === 1) {
            $ip = $m[1];
        }

        return filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) !== false;
    }

    private static function absolutise(string $location, string $base): string
    {
        if (preg_match('#^https?://#i', $location) === 1) {
            return $location;
        }

        $parsed = parse_url($base);
        $origin = ($parsed['scheme'] ?? 'https') . '://' . ($parsed['host'] ?? '')
            . (isset($parsed['port']) ? ':' . $parsed['port'] : '');

        if (str_starts_with($location, '//')) {
            return ($parsed['scheme'] ?? 'https') . ':' . $location;
        }
        if (str_starts_with($location, '/')) {
            return $origin . $location;
        }

        $dir = rtrim(dirname($parsed['path'] ?? '/'), '/');

        return $origin . $dir . '/' . $location;
    }
}
