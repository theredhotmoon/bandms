<?php

namespace Tests\Support;

use App\Assistant\Text\MessagesGateway;

/**
 * The one seam between our driver and the SDK, stubbed: records the params
 * it was given and answers with whatever the closure returns (or throws).
 */
final class StubMessagesGateway implements MessagesGateway
{
    public array $lastParams = [];

    public function __construct(private readonly \Closure $answer) {}

    public function create(array $params): object
    {
        $this->lastParams = $params;

        return ($this->answer)($params);
    }
}
