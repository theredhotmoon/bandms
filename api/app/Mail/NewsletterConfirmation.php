<?php

namespace App\Mail;

use App\Models\NewsletterSubscriber;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class NewsletterConfirmation extends Mailable
{
    use Queueable, SerializesModels;

    public string $confirmUrl;
    public string $unsubscribeUrl;

    public function __construct(public readonly NewsletterSubscriber $subscriber)
    {
        $base = rtrim(config('newsletter.frontend_url'), '/');

        $this->confirmUrl    = "{$base}/newsletter/confirm/{$subscriber->confirmation_token}";
        $this->unsubscribeUrl = "{$base}/newsletter/unsubscribe/{$subscriber->unsubscribe_token}";
    }

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Confirm your newsletter subscription');
    }

    public function content(): Content
    {
        return new Content(view: 'mail.newsletter.confirmation');
    }
}
