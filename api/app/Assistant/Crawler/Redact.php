<?php

namespace App\Assistant\Crawler;

/**
 * Strips credentials from a crawl error before it is logged or stored in
 * assistant_runs.error, which admins read.
 *
 * Sources send their keys in headers (X-goog-api-key), but that is a
 * convention a new source can forget, and Guzzle's connection errors quote
 * the full request URL — so `?key=AIza…` would arrive here verbatim. Two
 * passes: any credential-shaped query parameter, then the literal value of
 * every configured service secret wherever it appears.
 */
final class Redact
{
    private const MASK = '[redacted]';

    /** Query-parameter names that carry a credential. */
    private const PARAM = '/([?&](?:key|api_?key|apikey|access_token|token|client_secret|secret)=)[^&#\s"\']+/i';

    /** `config('services.*')` keys whose values are secrets. */
    private const SECRET_NAME = '/key|secret|token|password/i';

    /** Shorter values are skipped: masking "ab" would mangle ordinary text. */
    private const MIN_SECRET_LENGTH = 8;

    public static function message(string $message): string
    {
        $message = preg_replace(self::PARAM, '$1' . self::MASK, $message) ?? $message;

        foreach (self::configuredSecrets() as $secret) {
            $message = str_replace($secret, self::MASK, $message);
        }

        return $message;
    }

    /** @return list<string> */
    private static function configuredSecrets(): array
    {
        $found = [];
        $walk  = function (mixed $value, string $name) use (&$walk, &$found): void {
            if (is_array($value)) {
                foreach ($value as $k => $v) {
                    $walk($v, (string) $k);
                }
            } elseif (is_string($value) && strlen($value) >= self::MIN_SECRET_LENGTH && preg_match(self::SECRET_NAME, $name)) {
                $found[] = $value;
            }
        };
        $walk(config('services', []), '');

        return $found;
    }
}
