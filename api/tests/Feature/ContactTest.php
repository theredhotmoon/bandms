<?php

use App\Mail\ContactInquiry;
use Illuminate\Support\Facades\Mail;

describe('POST /api/contact', function () {
    it('is publicly accessible', function () {
        Mail::fake();

        $this->postJson('/api/contact', [
            'reason'  => 'general',
            'name'    => 'Ska Fan',
            'email'   => 'fan@music.com',
            'message' => 'Love your music!',
        ])->assertCreated();
    });

    it('sends a ContactInquiry email to the configured address', function () {
        Mail::fake();
        config(['contact.email' => 'test-contact@example.com']);

        $this->postJson('/api/contact', [
            'reason'  => 'booking',
            'name'    => 'Promoter Joe',
            'email'   => 'joe@venue.com',
            'subject' => 'Festival slot in July',
            'message' => 'We have a 500-capacity stage available.',
        ])->assertCreated()
          ->assertJsonPath('message', 'Message sent.');

        Mail::assertSent(ContactInquiry::class, function ($mail) {
            return $mail->hasTo('test-contact@example.com')
                && str_contains($mail->envelope()->subject, 'Booking');
        });
    });

    it('includes reply-to set to the sender email', function () {
        Mail::fake();

        $this->postJson('/api/contact', [
            'reason'  => 'press',
            'name'    => 'Journalist Jane',
            'email'   => 'jane@magazine.com',
            'message' => 'Interview request.',
        ])->assertCreated();

        Mail::assertSent(ContactInquiry::class, function ($mail) {
            $replyTo = $mail->envelope()->replyTo;
            return count($replyTo) === 1 && $replyTo[0]->address === 'jane@magazine.com';
        });
    });

    it('silently accepts but ignores spam when honeypot is filled', function () {
        Mail::fake();

        $this->postJson('/api/contact', [
            'reason'  => 'general',
            'name'    => 'Bot',
            'email'   => 'bot@spam.com',
            'message' => 'Buy my stuff',
            'website' => 'http://spam.example.com',
        ])->assertCreated();

        Mail::assertNothingSent();
    });

    it('validates reason is required', function () {
        $this->postJson('/api/contact', [
            'name'    => 'Fan',
            'email'   => 'fan@music.com',
            'message' => 'Hello!',
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['reason']);
    });

    it('validates reason must be one of the allowed values', function () {
        $this->postJson('/api/contact', [
            'reason'  => 'spam',
            'name'    => 'Fan',
            'email'   => 'fan@music.com',
            'message' => 'Hello!',
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['reason']);
    });

    it('validates name is required', function () {
        $this->postJson('/api/contact', [
            'reason'  => 'general',
            'email'   => 'fan@music.com',
            'message' => 'Hello!',
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['name']);
    });

    it('validates email is required', function () {
        $this->postJson('/api/contact', [
            'reason'  => 'general',
            'name'    => 'Fan',
            'message' => 'Hello!',
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['email']);
    });

    it('validates email must be a valid email address', function () {
        $this->postJson('/api/contact', [
            'reason'  => 'general',
            'name'    => 'Fan',
            'email'   => 'not-an-email',
            'message' => 'Hello!',
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['email']);
    });

    it('validates message is required', function () {
        $this->postJson('/api/contact', [
            'reason' => 'general',
            'name'   => 'Fan',
            'email'  => 'fan@music.com',
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['message']);
    });

    it('accepts an optional subject', function () {
        Mail::fake();

        $this->postJson('/api/contact', [
            'reason'  => 'other',
            'name'    => 'Fan',
            'email'   => 'fan@music.com',
            'message' => 'Hello!',
        ])->assertCreated();
    });

    it('rejects a message exceeding 5000 characters', function () {
        $this->postJson('/api/contact', [
            'reason'  => 'general',
            'name'    => 'Fan',
            'email'   => 'fan@music.com',
            'message' => str_repeat('a', 5001),
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['message']);
    });

    it('rejects a name exceeding 255 characters', function () {
        $this->postJson('/api/contact', [
            'reason'  => 'general',
            'name'    => str_repeat('a', 256),
            'email'   => 'fan@music.com',
            'message' => 'Hello!',
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['name']);
    });
});
