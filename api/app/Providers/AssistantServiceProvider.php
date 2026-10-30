<?php

namespace App\Providers;

use Anthropic\Client;
use App\Assistant\Text\AnthropicTextModel;
use App\Assistant\Text\NullTextModel;
use App\Assistant\Text\SdkMessagesGateway;
use App\Assistant\Text\TextModel;
use App\Assistant\Translation\DeepLTranslator;
use App\Assistant\Translation\NullTranslator;
use App\Assistant\Translation\Translator;
use Illuminate\Support\ServiceProvider;

/**
 * Binds each assistant capability to the driver config/assistant.php names.
 *
 * A chosen driver whose key is missing degrades to the Null driver rather than
 * failing at boot: the admin then shows no control, and `capabilities` is how
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

        $this->app->singleton(TextModel::class, function (): TextModel {
            $key = (string) config('services.anthropic.api_key', '');

            return match (config('assistant.text_model')) {
                'anthropic' => $key !== ''
                    ? new AnthropicTextModel(
                        new SdkMessagesGateway(new Client(apiKey: $key)),
                        (string) config('assistant.text_model_id'), // the default lives in config/assistant.php only
                    )
                    : new NullTextModel(),
                default => new NullTextModel(),
            };
        });
    }
}
