<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/**
 * The assistant's Monday digest (DigestBuilder decides what is in it). The
 * inbox link follows ADMIN_PATH, so a relocated admin panel still gets a
 * working link.
 */
class AssistantDigest extends Mailable
{
    use Queueable;

    public string $inboxUrl;

    /** @param  array<string, mixed>  $digest  DigestBuilder::build() */
    public function __construct(public readonly array $digest)
    {
        $base = rtrim((string) config('newsletter.frontend_url'), '/');
        $path = trim((string) config('assistant.admin_path', 'admin'), '/') ?: 'admin';

        $this->inboxUrl = "{$base}/{$path}/assistant";
    }

    public function envelope(): Envelope
    {
        $leads = array_sum(array_map('count', $this->digest['leads']));
        $parts = array_filter([
            $leads ? "{$leads} new " . ($leads === 1 ? 'lead' : 'leads') : null,
            ($m = count($this->digest['mentions'])) ? "{$m} " . ($m === 1 ? 'mention' : 'mentions') : null,
            ($n = count($this->digest['news'])) ? "{$n} news" : null,
        ]);

        return new Envelope(subject: 'Assistant: ' . implode(', ', $parts));
    }

    public function content(): Content
    {
        return new Content(view: 'mail.assistant.digest');
    }
}
