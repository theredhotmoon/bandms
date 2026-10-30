<?php

namespace App\Assistant\Text;

/**
 * The one seam between AnthropicTextModel and the SDK: a messages.create
 * call by named parameters. Tests stub it; production wraps the SDK client.
 */
interface MessagesGateway
{
    /**
     * @param  array<string, mixed>  $params  the SDK's named arguments (maxTokens, messages, model, …)
     * @return object  the SDK message: ->content (blocks with ->type/->text), ->stopReason, ->model
     *
     * @throws \Anthropic\Core\Exceptions\AnthropicException
     */
    public function create(array $params): object;
}
