<?php

declare(strict_types=1);

namespace App\Support;

use Illuminate\Http\Client\Response;
use Psr\Http\Message\ResponseInterface;
use RuntimeException;
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
     * @param  int|null  $maxBytes  stop the download past this size (see sizeGuard)
     */
    public static function get(string $url, int $timeout, array $headers = [], ?int $maxBytes = null): ?Response
    {
        for ($hop = 0; $hop <= self::MAX_REDIRECTS; $hop++) {
            $target = self::resolve($url);
            if ($target === null) {
                return null;
            }

            $options = ['allow_redirects' => false, 'curl' => []];
            if ($target['ips'] !== []) {
                $options['curl'][CURLOPT_RESOLVE] = array_map(
                    fn (string $ip) => "{$target['host']}:{$target['port']}:" . (str_contains($ip, ':') ? "[{$ip}]" : $ip),
                    $target['ips'],
                );
            }
            $tripped = new \ArrayObject();
            if ($maxBytes !== null) {
                $guard = self::sizeGuard($maxBytes, $tripped);
                $options['on_headers'] = $guard['on_headers'];
                $options['curl'] += $guard['curl'];
            }

            try {
                $response = Http::withHeaders($headers)->withOptions($options)->timeout($timeout)->get($url);
            } catch (\Throwable $e) {
                // Guzzle wraps both trips (an on_headers error, a callback
                // abort) in generic messages; say what actually happened.
                if ($tripped->count() > 0) {
                    throw new RuntimeException(
                        "The response from {$target['host']} is larger than " . number_format($maxBytes / 1_000_000, 1) . ' MB.', 0, $e,
                    );
                }
                throw $e;
            }

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
     * Options that stop a download larger than $maxBytes while it happens:
     * `on_headers` refuses a declared Content-Length over the limit before
     * the body is read, and curl's XFERINFOFUNCTION returns non-zero — which
     * is what makes curl abort — once an undeclared body passes it. (Throwing
     * from Guzzle's `progress` option does not abort: curl only stops on a
     * non-zero return, and a probe against a slow 5 MB stream downloaded the
     * lot.) Each trip is recorded in $tripped so get() can name it.
     *
     * @return array{on_headers: callable, curl: array<int, mixed>}
     */
    public static function sizeGuard(int $maxBytes, \ArrayObject $tripped): array
    {
        return [
            'on_headers' => function (ResponseInterface $response) use ($maxBytes, $tripped): void {
                $length = $response->getHeaderLine('Content-Length');
                if ($length !== '' && (int) $length > $maxBytes) {
                    $tripped->append('content-length');
                    throw new RuntimeException('Declared size over the limit.');
                }
            },
            'curl' => [
                CURLOPT_NOPROGRESS       => false,
                CURLOPT_XFERINFOFUNCTION => function ($handle, $downloadTotal, $downloaded) use ($maxBytes, $tripped): int {
                    if ($downloaded > $maxBytes) {
                        $tripped->append('downloaded');

                        return 1;
                    }

                    return 0;
                },
            ],
        ];
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
