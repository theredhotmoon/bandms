<?php

use App\Mail\NewsletterConfirmation;
use App\Models\NewsletterSubscriber;
use App\Models\User;
use Illuminate\Support\Facades\Mail;
use Laravel\Passport\Passport;

// ── POST /api/newsletter/subscribe ───────────────────────────────────────────

describe('POST /api/newsletter/subscribe', function () {
    it('is publicly accessible', function () {
        Mail::fake();
        $this->postJson('/api/newsletter/subscribe', ['email' => 'fan@music.com'])
            ->assertCreated();
    });

    it('subscribes a new email and sends a confirmation email', function () {
        Mail::fake();

        $this->postJson('/api/newsletter/subscribe', [
            'email'  => 'fan@music.com',
            'name'   => 'Ska Fan',
            'source' => 'website',
        ])->assertCreated()
          ->assertJsonPath('message', 'Check your inbox to confirm your subscription.');

        $this->assertDatabaseHas('newsletter_subscribers', [
            'email' => 'fan@music.com',
            'name'  => 'Ska Fan',
        ]);

        $sub = NewsletterSubscriber::where('email', 'fan@music.com')->first();
        expect($sub->confirmation_token)->not->toBeNull();
        expect($sub->unsubscribe_token)->not->toBeNull();
        expect($sub->confirmed_at)->toBeNull();

        Mail::assertSent(NewsletterConfirmation::class, fn ($mail) =>
            $mail->hasTo('fan@music.com')
        );
    });

    it('silently accepts but ignores spam when honeypot is filled', function () {
        Mail::fake();

        $this->postJson('/api/newsletter/subscribe', [
            'email'   => 'spam@example.com',
            'website' => 'http://spam.example.com',
        ])->assertCreated();

        $this->assertDatabaseMissing('newsletter_subscribers', ['email' => 'spam@example.com']);
        Mail::assertNothingSent();
    });

    it('rejects email domain with no DNS records when MX check is enabled', function () {
        config(['newsletter.verify_mx' => true]);

        $this->postJson('/api/newsletter/subscribe', [
            'email' => 'test@this-domain-absolutely-does-not-exist-xyz123.invalid',
        ])->assertUnprocessable()
          ->assertJsonPath('message', 'The email address domain does not appear to be valid.');
    });

    it('returns 200 and resends email when pending subscriber tries to resubscribe', function () {
        Mail::fake();

        NewsletterSubscriber::create([
            'email'              => 'pending@music.com',
            'subscribed_at'      => now(),
            'confirmation_token' => 'old-token',
            'unsubscribe_token'  => 'old-unsub',
        ]);

        $this->postJson('/api/newsletter/subscribe', ['email' => 'pending@music.com'])
            ->assertOk()
            ->assertJsonPath('message', 'Check your inbox to confirm your subscription.');

        $this->assertDatabaseCount('newsletter_subscribers', 1);
        Mail::assertSent(NewsletterConfirmation::class);
    });

    it('returns 200 and sends no email when confirmed subscriber tries to resubscribe', function () {
        Mail::fake();

        NewsletterSubscriber::create([
            'email'        => 'confirmed@music.com',
            'subscribed_at' => now(),
            'confirmed_at'  => now(),
            'unsubscribe_token' => 'some-token',
        ]);

        $this->postJson('/api/newsletter/subscribe', ['email' => 'confirmed@music.com'])
            ->assertOk()
            ->assertJsonPath('message', 'You are already subscribed.');

        $this->assertDatabaseCount('newsletter_subscribers', 1);
        Mail::assertNothingSent();
    });

    it('validates email is required', function () {
        $this->postJson('/api/newsletter/subscribe', ['name' => 'No Email'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);
    });

    it('validates email must be a valid email address', function () {
        $this->postJson('/api/newsletter/subscribe', ['email' => 'not-an-email'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);
    });
});

// ── GET /api/newsletter/confirm/{token} ──────────────────────────────────────

describe('GET /api/newsletter/confirm/{token}', function () {
    it('confirms a subscriber with a valid token', function () {
        $subscriber = NewsletterSubscriber::create([
            'email'              => 'confirm@music.com',
            'subscribed_at'      => now(),
            'confirmation_token' => 'valid-confirm-token',
            'unsubscribe_token'  => 'some-unsub-token',
        ]);

        $this->getJson('/api/newsletter/confirm/valid-confirm-token')
            ->assertOk()
            ->assertJsonPath('message', 'Your subscription has been confirmed.');

        $subscriber->refresh();
        expect($subscriber->confirmed_at)->not->toBeNull();
        expect($subscriber->confirmation_token)->toBeNull();
    });

    it('returns 404 for an invalid or already-used confirmation token', function () {
        $this->getJson('/api/newsletter/confirm/no-such-token')
            ->assertNotFound();
    });
});

// ── GET /api/newsletter/unsubscribe/{token} ───────────────────────────────────

describe('GET /api/newsletter/unsubscribe/{token}', function () {
    it('removes a subscriber with a valid unsubscribe token', function () {
        $subscriber = NewsletterSubscriber::create([
            'email'             => 'unsub@music.com',
            'subscribed_at'     => now(),
            'confirmed_at'      => now(),
            'unsubscribe_token' => 'valid-unsub-token',
        ]);

        $this->getJson('/api/newsletter/unsubscribe/valid-unsub-token')
            ->assertOk()
            ->assertJsonPath('message', 'You have been unsubscribed.');

        $this->assertDatabaseMissing('newsletter_subscribers', ['id' => $subscriber->id]);
    });

    it('returns 404 for an invalid unsubscribe token', function () {
        $this->getJson('/api/newsletter/unsubscribe/no-such-token')
            ->assertNotFound();
    });
});

// ── GET /api/newsletter-subscribers ──────────────────────────────────────────

describe('GET /api/newsletter-subscribers', function () {
    it('returns 401 without authentication', function () {
        $this->getJson('/api/newsletter-subscribers')->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->getJson('/api/newsletter-subscribers')->assertForbidden();
    });

    it('returns paginated subscriber list including confirmed_at', function () {
        $this->actingAsAdmin();
        NewsletterSubscriber::create([
            'email'        => 'a@test.com',
            'subscribed_at' => now(),
            'confirmed_at'  => now(),
            'unsubscribe_token' => 'tok-a',
        ]);
        NewsletterSubscriber::create([
            'email'        => 'b@test.com',
            'subscribed_at' => now(),
            'unsubscribe_token' => 'tok-b',
        ]);

        $this->getJson('/api/newsletter-subscribers')
            ->assertSuccessful()
            ->assertJsonStructure(['data' => [['id', 'email', 'name', 'source', 'subscribed_at', 'confirmed_at']], 'meta']);
    });
});

// ── DELETE /api/newsletter-subscribers/{subscriber} ──────────────────────────

describe('DELETE /api/newsletter-subscribers/{subscriber}', function () {
    it('returns 401 without authentication', function () {
        $subscriber = NewsletterSubscriber::create(['email' => 'del@test.com', 'subscribed_at' => now()]);

        $this->deleteJson("/api/newsletter-subscribers/{$subscriber->id}")->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        $subscriber = NewsletterSubscriber::create(['email' => 'del@test.com', 'subscribed_at' => now()]);
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->deleteJson("/api/newsletter-subscribers/{$subscriber->id}")->assertForbidden();
    });

    it('deletes a subscriber', function () {
        $this->actingAsAdmin();
        $subscriber = NewsletterSubscriber::create(['email' => 'gone@test.com', 'subscribed_at' => now()]);

        $this->deleteJson("/api/newsletter-subscribers/{$subscriber->id}")->assertNoContent();

        $this->assertDatabaseMissing('newsletter_subscribers', ['id' => $subscriber->id]);
    });

    it('returns 404 for a non-existent subscriber', function () {
        $this->actingAsAdmin();

        $this->deleteJson('/api/newsletter-subscribers/9999')->assertNotFound();
    });
});
