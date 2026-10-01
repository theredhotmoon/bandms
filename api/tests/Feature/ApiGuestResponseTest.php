<?php

use App\Models\Release;

uses(\Illuminate\Foundation\Testing\RefreshDatabase::class);

/*
 * A protected API route hit without `Accept: application/json` used to 500:
 * Laravel answered the guest with a redirect to route('login'), and that
 * route was deleted with the SPA's login page. Browsers never saw it — the
 * admin always sends the header — but every scanner and plain curl did, and a
 * 500 reads as "something is broken here" in a way a 401 does not.
 */
describe('a guest on a protected API route', function () {
    it('gets 401 JSON even without an Accept header', function () {
        $this->get('/api/user')
            ->assertUnauthorized()
            ->assertJson(['message' => 'Unauthenticated.']);
    });

    it('gets 401 JSON on an admin route too', function () {
        $this->get('/api/admin/posts')->assertUnauthorized();
    });

    // The other half of "render JSON for the API": a validation failure from a
    // client that forgot the header must be a 422 body, not a redirect back.
    it('gets a 422 body, not a redirect, for a validation error', function () {
        $this->post('/api/auth/login', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);
    });
});

/*
 * releases.type is an enum of LP, EP, single, compilation. The factory used
 * to pick 'Single', which SQLite stores without complaint and MySQL rejects,
 * and which ReleaseController's `in:` rule rejects on update — so any test that
 * echoed a factory release's type back to the API failed one run in three.
 */
it('only makes releases whose type the API accepts', function () {
    $types = collect(range(1, 40))->map(fn () => Release::factory()->make()->type)->unique();

    expect($types->diff(['LP', 'EP', 'single', 'compilation']))->toBeEmpty();
});
