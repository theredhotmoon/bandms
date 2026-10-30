<?php

namespace App\Providers;

use App\Assistant\Translation\DeepLTranslator;
use App\Assistant\Translation\NullTranslator;
use App\Assistant\Translation\Translator;
use Illuminate\Support\ServiceProvider;

/**
 * Binds each assistant capability to the driver config/assistant.php names.
 *
 * A chosen driver whose key is missing degrades to NullTranslator rather than
 * failing at boot: the admin then shows no button, and `capabilities` is how
 * a person finds out — not a 500 on every page load.
 */
class AssistantServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(Translator::class, function (): Translator {
            $key = (string) config('services.deepl.api_key', '');

            return match (config('assistant.translator')) {
                'deepl' => $key !== ''
                    ? new DeepLTranslator($key, (int) config('assistant.cache_ttl_days', 30))
                    : new NullTranslator(),
                default => new NullTranslator(),
            };
        });
    }
}
