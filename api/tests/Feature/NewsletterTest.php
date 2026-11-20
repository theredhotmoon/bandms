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

    it('returns 403 for an admin who is not a superadmin', function () {
        $this->actingAsAdmin();

        $this->getJson('/api/newsletter-subscribers')
            ->assertForbidden()
            ->assertJsonPath('message', 'Only a superadmin can do this.');
    });

    it('returns 403 for non-admin roles', function () {
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->getJson('/api/newsletter-subscribers')->assertForbidden();
    });

    it('returns paginated subscriber list including confirmed_at', function () {
        $this->actingAsSuperadmin();
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

// ── PUT /api/newsletter-subscribers/{subscriber} ─────────────────────────────

describe('PUT /api/newsletter-subscribers/{subscriber}', function () {
    $confirmed = fn (array $attrs = []) => NewsletterSubscriber::create(array_merge([
        'email'             => 'old@music.com',
        'name'              => 'Old Name',
        'subscribed_at'     => now()->subDay(),
        'confirmed_at'      => now()->subDay(),
        'unsubscribe_token' => 'unsub-old',
    ], $attrs));

    it('returns 401 without authentication', function () use ($confirmed) {
        $sub = $confirmed();

        $this->putJson("/api/newsletter-subscribers/{$sub->id}", ['email' => 'x@music.com'])
            ->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () use ($confirmed) {
        $sub = $confirmed();
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->putJson("/api/newsletter-subscribers/{$sub->id}", ['email' => 'x@music.com'])
            ->assertForbidden();
    });

    it('returns 403 for an admin who is not a superadmin, and changes nothing', function () use ($confirmed) {
        Mail::fake();
        $sub = $confirmed();
        $this->actingAsAdmin();

        $this->putJson("/api/newsletter-subscribers/{$sub->id}", ['email' => 'new@music.com'])
            ->assertForbidden();

        expect($sub->fresh()->email)->toBe('old@music.com');
        Mail::assertNothingSent();
    });

    it('changes only the name without touching confirmation or sending mail', function () use ($confirmed) {
        Mail::fake();
        $this->actingAsSuperadmin();
        $sub = $confirmed();

        $this->putJson("/api/newsletter-subscribers/{$sub->id}", [
            'email' => 'old@music.com',
            'name'  => 'New Name',
        ])->assertOk()
          ->assertJsonPath('data.name', 'New Name')
          ->assertJsonPath('confirmation_sent', false);

        $sub->refresh();
        expect($sub->confirmed_at)->not->toBeNull();
        Mail::assertNothingSent();
    });

    it('treats a case-only difference as the same address', function () use ($confirmed) {
        Mail::fake();
        $this->actingAsSuperadmin();
        $sub = $confirmed();

        $this->putJson("/api/newsletter-subscribers/{$sub->id}", ['email' => '  OLD@Music.com '])
            ->assertOk()
            ->assertJsonPath('confirmation_sent', false);

        expect($sub->fresh()->confirmed_at)->not->toBeNull();
        Mail::assertNothingSent();
    });

    it('resets a changed email to pending and mails a new confirmation link', function () use ($confirmed) {
        Mail::fake();
        $this->actingAsSuperadmin();
        $sub = $confirmed(['confirmation_token' => null]);

        $this->putJson("/api/newsletter-subscribers/{$sub->id}", [
            'email' => 'New@Music.com',
            'name'  => 'Old Name',
        ])->assertOk()
          ->assertJsonPath('data.email', 'new@music.com')
          ->assertJsonPath('data.confirmed_at', null)
          ->assertJsonPath('email_changed', true)
          ->assertJsonPath('confirmation_sent', true);

        $sub->refresh();
        expect($sub->confirmed_at)->toBeNull()
            ->and($sub->confirmation_token)->toHaveLength(64)
            ->and($sub->unsubscribe_token)->toHaveLength(64)
            ->and($sub->unsubscribe_token)->not->toBe('unsub-old');

        Mail::assertSent(NewsletterConfirmation::class, fn ($mail) =>
            $mail->hasTo('new@music.com') && !$mail->hasTo('old@music.com')
        );
    });

    it('replaces a pending token so the link sent to the old address stops working', function () use ($confirmed) {
        Mail::fake();
        $this->actingAsSuperadmin();
        $sub = $confirmed(['confirmed_at' => null, 'confirmation_token' => 'link-sent-to-old']);

        $this->putJson("/api/newsletter-subscribers/{$sub->id}", ['email' => 'new@music.com'])
            ->assertOk();

        $this->getJson('/api/newsletter/confirm/link-sent-to-old')->assertNotFound();
        expect($sub->fresh()->confirmed_at)->toBeNull();
    });

    it('stops an unsubscribe link mailed to the old address from removing the new one', function () use ($confirmed) {
        Mail::fake();
        $this->actingAsSuperadmin();
        $sub = $confirmed();

        $this->putJson("/api/newsletter-subscribers/{$sub->id}", ['email' => 'new@music.com'])->assertOk();

        $this->getJson('/api/newsletter/unsubscribe/unsub-old')->assertNotFound();
        $this->assertDatabaseHas('newsletter_subscribers', ['id' => $sub->id]);
    });

    it('keeps a legacy mixed-case address confirmed on a rename', function () use ($confirmed) {
        Mail::fake();
        $this->actingAsSuperadmin();
        $sub = $confirmed(['email' => 'Legacy@Music.com']);

        $this->putJson("/api/newsletter-subscribers/{$sub->id}", ['email' => 'Legacy@Music.com', 'name' => 'Renamed'])
            ->assertOk()
            ->assertJsonPath('email_changed', false);

        $sub->refresh();
        expect($sub->confirmed_at)->not->toBeNull()
            ->and($sub->email)->toBe('legacy@music.com');
        Mail::assertNothingSent();
    });

    it('saves the change and says so when the confirmation mail fails', function () use ($confirmed) {
        Mail::shouldReceive('to')->andThrow(new RuntimeException('SMTP down'));
        $this->actingAsSuperadmin();
        $sub = $confirmed();

        $this->putJson("/api/newsletter-subscribers/{$sub->id}", ['email' => 'new@music.com'])
            ->assertOk()
            ->assertJsonPath('email_changed', true)
            ->assertJsonPath('confirmation_sent', false);

        expect($sub->fresh()->email)->toBe('new@music.com');
    });

    it('answers a non-string email with a 422, not a 500', function () use ($confirmed) {
        $this->actingAsSuperadmin();
        $sub = $confirmed();

        $this->putJson("/api/newsletter-subscribers/{$sub->id}", ['email' => ['a@b.c']])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('email');
    });

    it('clears the name when sent blank', function () use ($confirmed) {
        $this->actingAsSuperadmin();
        $sub = $confirmed();

        $this->putJson("/api/newsletter-subscribers/{$sub->id}", ['email' => 'old@music.com', 'name' => '  '])
            ->assertOk()
            ->assertJsonPath('data.name', null);
    });

    it('rejects an email another subscriber already has', function () use ($confirmed) {
        Mail::fake();
        $this->actingAsSuperadmin();
        $sub = $confirmed();
        $confirmed(['email' => 'taken@music.com', 'unsubscribe_token' => 'unsub-taken']);

        $this->putJson("/api/newsletter-subscribers/{$sub->id}", ['email' => 'TAKEN@music.com'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('email');

        expect($sub->fresh()->email)->toBe('old@music.com');
        Mail::assertNothingSent();
    });

    it('rejects a missing or malformed email', function () use ($confirmed) {
        $this->actingAsSuperadmin();
        $sub = $confirmed();

        $this->putJson("/api/newsletter-subscribers/{$sub->id}", ['email' => ''])
            ->assertJsonValidationErrors('email');
        $this->putJson("/api/newsletter-subscribers/{$sub->id}", ['email' => 'not-an-email'])
            ->assertJsonValidationErrors('email');
    });

    it('rejects a new address whose domain does not resolve when the MX check is on', function () use ($confirmed) {
        Mail::fake();
        config(['newsletter.verify_mx' => true]);
        $this->actingAsSuperadmin();
        $sub = $confirmed();

        $this->putJson("/api/newsletter-subscribers/{$sub->id}", [
            'email' => 'fan@this-domain-absolutely-does-not-exist-xyz123.invalid',
        ])->assertUnprocessable()
          ->assertJsonValidationErrors('email');

        expect($sub->fresh()->confirmed_at)->not->toBeNull();
        Mail::assertNothingSent();
    });

    it('returns 404 for a non-existent subscriber', function () {
        $this->actingAsSuperadmin();

        $this->putJson('/api/newsletter-subscribers/9999', ['email' => 'x@music.com'])->assertNotFound();
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

    it('returns 403 for an admin who is not a superadmin, and keeps the row', function () {
        $subscriber = NewsletterSubscriber::create(['email' => 'stay@test.com', 'subscribed_at' => now()]);
        $this->actingAsAdmin();

        $this->deleteJson("/api/newsletter-subscribers/{$subscriber->id}")->assertForbidden();

        $this->assertDatabaseHas('newsletter_subscribers', ['id' => $subscriber->id]);
    });

    it('deletes a subscriber', function () {
        $this->actingAsSuperadmin();
        $subscriber = NewsletterSubscriber::create(['email' => 'gone@test.com', 'subscribed_at' => now()]);

        $this->deleteJson("/api/newsletter-subscribers/{$subscriber->id}")->assertNoContent();

        $this->assertDatabaseMissing('newsletter_subscribers', ['id' => $subscriber->id]);
    });

    it('returns 404 for a non-existent subscriber', function () {
        $this->actingAsSuperadmin();

        $this->deleteJson('/api/newsletter-subscribers/9999')->assertNotFound();
    });
});
