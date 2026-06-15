<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ContactInquiry extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public readonly array $data) {}

    public function envelope(): Envelope
    {
        $strip = fn(string $s): string => preg_replace('/[\r\n]+/', ' ', $s);

        $label   = $strip(ucfirst($this->data['reason']));
        $subject = $strip($this->data['subject'] ?? $this->data['name']);

        return new Envelope(
            subject: "[Contact] {$label} — {$subject}",
            replyTo: [new Address($this->data['email'], $strip($this->data['name']))],
        );
    }

    public function content(): Content
    {
        $replyHref = 'mailto:' . rawurlencode($this->data['email'])
            . '?subject=' . rawurlencode('Re: ' . ($this->data['subject'] ?? 'Your message'));

        return new Content(view: 'mail.contact.inquiry', with: [
            'data'      => $this->data,
            'replyHref' => $replyHref,
        ]);
    }
}
