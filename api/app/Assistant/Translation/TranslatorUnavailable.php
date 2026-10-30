<?php

namespace App\Assistant\Translation;

/**
 * The provider could not translate, and the admin should say why in a toast.
 * `userMessage` is the whole of what reaches the browser; provider details
 * stay in the log.
 */
final class TranslatorUnavailable extends \RuntimeException
{
    public function __construct(public readonly string $userMessage, ?\Throwable $previous = null)
    {
        parent::__construct($userMessage, 0, $previous);
    }
}
