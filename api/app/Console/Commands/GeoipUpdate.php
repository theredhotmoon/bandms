<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use PharData;
use Throwable;

class GeoipUpdate extends Command
{
    protected $signature = 'geoip:update';

    protected $description = 'Download the MaxMind GeoLite2-City database used by the welcome screen';

    private const URL = 'https://download.maxmind.com/geoip/databases/GeoLite2-City/download?suffix=tar.gz';

    public function handle(): int
    {
        $key = (string) config('geoip.license_key');
        if ($key === '') {
            $this->info('geoip:update skipped: no licence key (MAXMIND_LICENSE_KEY).');

            return self::SUCCESS;
        }

        $target = (string) config('geoip.path');
        $dir = dirname($target);
        if (! is_dir($dir) && ! @mkdir($dir, 0775, true) && ! is_dir($dir)) {
            $this->error('geoip:update failed: cannot create the target directory.');

            return self::FAILURE;
        }

        $work = sys_get_temp_dir().'/geoip-'.bin2hex(random_bytes(6));
        mkdir($work);

        try {
            // Credentials travel in basic auth, never the URL: an HTTP error prints the URL.
            $response = Http::withBasicAuth((string) config('geoip.account_id'), $key)
                ->timeout(300)->sink($work.'/db.tar.gz')->get(self::URL);

            if (! $response->successful()) {
                $this->error('geoip:update failed: download answered HTTP '.$response->status().'.');

                return self::FAILURE;
            }

            $archive = new PharData($work.'/db.tar.gz');
            $prefix = 'phar://'.$work.'/db.tar.gz';
            $inner = null;
            foreach (new \RecursiveIteratorIterator($archive) as $file) {
                if (str_ends_with($file->getPathname(), '.mmdb')) {
                    $inner = ltrim(substr($file->getPathname(), strlen($prefix)), '/');
                    break;
                }
            }
            if ($inner === null) {
                $this->error('geoip:update failed: no .mmdb in the archive.');

                return self::FAILURE;
            }

            $archive->extractTo($work.'/x', $inner, true);

            // Staged beside the target, so the rename is atomic.
            $staged = $target.'.tmp';
            // The archive's member path never reaches the destination: the staged
            // name is fixed ($target.tmp), and the source is read inside $work only.
            if (! @copy($work.'/x/'.$inner, $staged) || ! @rename($staged, $target)) {
                @unlink($staged);
                $this->error('geoip:update failed: cannot install the database file.');

                return self::FAILURE;
            }
        } catch (Throwable $e) {
            $this->error('geoip:update failed: '.$e::class);

            return self::FAILURE;
        } finally {
            $this->rmrf($work);
        }

        $this->info('GeoLite2-City installed.');

        return self::SUCCESS;
    }

    private function rmrf(string $path): void
    {
        if (is_file($path) || is_link($path)) {
            @unlink($path);

            return;
        }
        foreach (scandir($path) ?: [] as $name) {
            if ($name !== '.' && $name !== '..') {
                $this->rmrf($path.'/'.$name);
            }
        }
        @rmdir($path);
    }
}
