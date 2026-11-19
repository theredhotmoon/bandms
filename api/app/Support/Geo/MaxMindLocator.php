<?php

namespace App\Support\Geo;

use GeoIp2\Database\Reader;
use GeoIp2\Exception\AddressNotFoundException;
use Throwable;

final class MaxMindLocator implements Locator
{
    private bool $reported = false;

    /** Opened on the first lookup and kept: the locator is a singleton. */
    private ?Reader $reader = null;

    public function locate(string $ip): ?Point
    {
        if (! $this->available()) {
            return null;
        }
        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false) {
            return null;
        }

        try {
            $loc = $this->reader()->city($ip)->location;
            if ($loc->latitude === null || $loc->longitude === null) {
                return null;
            }

            return new Point((float) $loc->latitude, (float) $loc->longitude);
        } catch (AddressNotFoundException) {
            return null;
        } catch (Throwable $e) {
            // Once per process, and the class only: a message may carry the address.
            if (! $this->reported) {
                $this->reported = true;
                report(new \RuntimeException('GeoIP lookup failed ('.$e::class.')'));
            }

            return null;
        }
    }

    public function available(): bool
    {
        return is_file($this->path());
    }

    private function reader(): Reader
    {
        return $this->reader ??= new Reader($this->path());
    }

    private function path(): string
    {
        return (string) config('geoip.path');
    }
}
