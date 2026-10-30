<?php

namespace App\Assistant\Text;

use Anthropic\Client;

/**
 * Production gateway: the official SDK's beta messages endpoint — beta
 * because the server-side refusal fallback lives there.
 */
final class SdkMessagesGateway implements MessagesGateway
{
    public function __construct(private readonly Client $client) {}

    public function create(array $params): object
    {
        return $this->client->beta->messages->create(...$params);
    }
}
