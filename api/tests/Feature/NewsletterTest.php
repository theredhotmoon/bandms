<?php

use App\Models\NewsletterSubscriber;
use App\Models\User;
use Laravel\Passport\Passport;

// ── POST /api/newsletter/subscribe ───────────────────────────────────────────

describe('POST /api/newsletter/subscribe', function () {
    it('is publicly accessible', function () {
        $this->postJson('/api/newsletter/subscribe', ['email' => 'fan@music.com'])
            ->assertCreated();
    });

    it('subscribes a new email', function () {
        $this->postJson('/api/newsletter/subscribe', [
            'email'  => 'fan@music.com',
            'name'   => 'Ska Fan',
            'source' => 'website',
        ])->assertCreated();

        $this->assertDatabaseHas('newsletter_subscribers', ['email' => 'fan@music.com', 'name' => 'Ska Fan']);
    });

    it('returns 200 when email is already subscribed', function () {
        NewsletterSubscriber::create(['email' => 'existing@music.com', 'subscribed_at' => now()]);

        $this->postJson('/api/newsletter/subscribe', ['email' => 'existing@music.com'])
            ->assertSuccessful();

        $this->assertDatabaseCount('newsletter_subscribers', 1);
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

// ── GET /api/newsletter-subscribers ──────────────────────────────────────────

describe('GET /api/newsletter-subscribers', function () {
    it('returns 401 without authentication', function () {
        $this->getJson('/api/newsletter-subscribers')->assertUnauthorized();
    });

    it('returns 403 for non-admin roles', function () {
        Passport::actingAs(User::factory()->create(['role' => 'member']));

        $this->getJson('/api/newsletter-subscribers')->assertForbidden();
    });

    it('returns paginated subscriber list', function () {
        $this->actingAsAdmin();
        NewsletterSubscriber::create(['email' => 'a@test.com', 'subscribed_at' => now()]);
        NewsletterSubscriber::create(['email' => 'b@test.com', 'subscribed_at' => now()]);

        $this->getJson('/api/newsletter-subscribers')
            ->assertSuccessful()
            ->assertJsonStructure(['data', 'meta']);
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
