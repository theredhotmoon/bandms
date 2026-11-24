<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/**
 * Tells a fan their password was set or changed — the one signal they get if
 * someone else did it. Rendered in the locale of the request that sent it.
 */
class FanPasswordChanged extends Mailable
{
    use Queueable;

    public function __construct(public bool $isFirst) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: __($this->isFirst ? 'api.fan.password_mail_subject_set' : 'api.fan.password_mail_subject_changed'));
    }

    public function content(): Content
    {
        return new Content(text: 'mail.fan.password-changed', with: [
            'headline' => __($this->isFirst ? 'api.fan.password_mail_set' : 'api.fan.password_mail_changed'),
            'warning'  => __('api.fan.password_mail_unexpected'),
        ]);
    }
}
