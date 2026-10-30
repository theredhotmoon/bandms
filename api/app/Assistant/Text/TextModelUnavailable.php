<?php

namespace App\Assistant\Text;

/**
 * The model could not answer, and the admin should say why in a toast.
 * `userMessage` is the whole of what reaches the browser; provider details
 * stay in the log.
 */
final class TextModelUnavailable extends \RuntimeException
{
    public function __construct(public readonly string $userMessage, ?\Throwable $previous = null)
    {
        parent::__construct($userMessage, 0, $previous);
    }
}
