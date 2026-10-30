<?php

namespace App\Assistant\Text;

use Anthropic\Core\Exceptions\AnthropicException;
use Anthropic\Core\Exceptions\APIConnectionException;
use Anthropic\Core\Exceptions\APITimeoutException;
use Anthropic\Core\Exceptions\AuthenticationException;
use Anthropic\Core\Exceptions\RateLimitException;
use Illuminate\Support\Facades\Log;

/**
 * Claude through the official SDK. Every call: the configured model, a 16k
 * token budget (thinking counts against it, and `longer` on a long Polish
 * text runs to ~12k), effort medium, adaptive thinking (the model's default
 * — omitted), and a request timeout under nginx's (`fastcgi_read_timeout`
 * 120 s) so a slow rewrite is a 503 the admin can show, not a 504 the band
 * cannot read. No prompt cache: the system prompt is below the cacheable
 * minimum.
 *
 * Rewrites opt into the server-side refusal fallback (a declined rewrite is
 * re-run on a fallback model inside the same call). Structured calls do not:
 * their caller is the cheaper triage model, which has no fallback.
 */
final class AnthropicTextModel implements TextModel
{
    private const MAX_TOKENS      = 16000;
    private const TIMEOUT_SECONDS = 110;
    private const BETAS           = ['server-side-fallback-2026-07-01'];

    public function __construct(
        private readonly MessagesGateway $gateway,
        private readonly string $modelId,
    ) {}

    public function name(): string
    {
        return 'anthropic';
    }

    public function rewrite(RewriteRequest $request): string
    {
        $prompt  = RewritePrompt::build($request);
        $message = $this->send([
            'maxTokens'      => self::MAX_TOKENS,
            'messages'       => [['role' => 'user', 'content' => $prompt['user']]],
            'model'          => $this->modelId,
            'system'         => $prompt['system'],
            'outputConfig'   => ['effort' => 'medium'],
            'betas'          => self::BETAS,
            'fallbacks'      => 'default',
            'requestOptions' => ['timeout' => self::TIMEOUT_SECONDS, 'maxRetries' => 1],
        ]);

        return $this->textOf($message);
    }

    public function structured(string $system, string $user, array $schema, ?string $model = null): array
    {
        $message = $this->send([
            'maxTokens'      => self::MAX_TOKENS,
            'messages'       => [['role' => 'user', 'content' => $user]],
            'model'          => $model ?? $this->modelId,
            'system'         => $system,
            'outputConfig'   => ['effort' => 'medium', 'format' => ['type' => 'json_schema', 'schema' => $schema]],
            'requestOptions' => ['timeout' => self::TIMEOUT_SECONDS, 'maxRetries' => 1],
        ]);

        $decoded = json_decode($this->textOf($message), true);
        if (!is_array($decoded)) {
            Log::warning('assistant.structured.malformed', ['model' => $model ?? $this->modelId]);
            throw new TextModelUnavailable('The assistant gave an unusable answer — try again.');
        }

        return $decoded;
    }

    /** @param array<string, mixed> $params */
    private function send(array $params): object
    {
        try {
            $message = $this->gateway->create($params);
        } catch (APITimeoutException $e) {
            Log::warning('assistant.text.timeout', ['error' => $e->getMessage()]);
            throw new TextModelUnavailable('The rewrite took too long — try a shorter text or mode.', $e);
        } catch (RateLimitException $e) {
            Log::warning('assistant.text.rate_limited', ['error' => $e->getMessage()]);
            throw new TextModelUnavailable('The assistant is busy — try again in a minute.', $e);
        } catch (AuthenticationException $e) {
            Log::warning('assistant.text.auth', ['error' => $e->getMessage()]);
            throw new TextModelUnavailable('The assistant rejected the API key.', $e);
        } catch (APIConnectionException | AnthropicException $e) {
            Log::warning('assistant.text.failed', ['error' => $e->getMessage(), 'class' => $e::class]);
            throw new TextModelUnavailable('Rewrite failed — try again.', $e);
        } catch (\Throwable $e) {
            // An SDK that changed under us (a renamed named parameter after a
            // major bump) is still a 503 with a message, never a bare 500.
            Log::error('assistant.text.broken', ['error' => $e->getMessage(), 'class' => $e::class]);
            throw new TextModelUnavailable('Rewrite failed — try again.', $e);
        }

        // The model that actually answered — with the fallback, not always the one asked.
        Log::info('assistant.text.served', ['requested' => $params['model'], 'served' => $message->model ?? null, 'stop' => $message->stopReason ?? null]);

        return $message;
    }

    /** The first text block, after the stop reason has been judged. */
    private function textOf(object $message): string
    {
        $stop = $message->stopReason ?? null;
        if ($stop === 'refusal') {
            throw new TextModelUnavailable('The model declined this text.');
        }
        if ($stop === 'max_tokens') {
            // A cut-off paragraph in the band's field is the one thing worse
            // than no rewrite.
            throw new TextModelUnavailable('The rewrite came out too long — try shorter.');
        }

        foreach ($message->content ?? [] as $block) {
            if (($block->type ?? null) === 'text' && is_string($block->text ?? null)) {
                return $block->text;
            }
        }

        throw new TextModelUnavailable('Rewrite failed — try again.');
    }
}
