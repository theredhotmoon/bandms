<?php

namespace Tests\Support;

use App\Assistant\Text\RewriteRequest;
use App\Assistant\Text\TextModel;
use App\Assistant\Text\TextModelUnavailable;

/**
 * The text model in tests: records what it was asked, answers what it was
 * told to. Bind it over TextModel::class in the container; no test may
 * reach Anthropic.
 */
final class FakeTextModel implements TextModel
{
    public ?RewriteRequest $lastRewrite = null;

    /** @var array{system:string,user:string,schema:array,model:?string}|null */
    public ?array $lastStructured = null;

    private ?string $reply = null;
    private ?TextModelUnavailable $throw = null;
    private array $structuredReply = [];

    public function name(): string
    {
        return 'fake';
    }

    public function reply(string $text): self
    {
        $this->reply = $text;
        return $this;
    }

    public function fail(string $message): self
    {
        $this->throw = new TextModelUnavailable($message);
        return $this;
    }

    public function answerStructured(array $json): self
    {
        $this->structuredReply = $json;
        return $this;
    }

    public function rewrite(RewriteRequest $request): string
    {
        $this->lastRewrite = $request;
        if ($this->throw) {
            throw $this->throw;
        }

        return $this->reply ?? "[{$request->mode->value}] {$request->text}";
    }

    public function structured(string $system, string $user, array $schema, ?string $model = null): array
    {
        $this->lastStructured = compact('system', 'user', 'schema', 'model');
        if ($this->throw) {
            throw $this->throw;
        }

        return $this->structuredReply;
    }
}
