<?php

use App\Models\Concert;
use App\Models\ConcertTicketType;
use App\Models\User;
use App\Models\Venue;

/*
 * These two listings very nearly collapsed into one.
 *
 * The public ticket-type listing and the admin issued-ticket listing were both
 * registered on GET /api/concerts/{concert}/tickets. Laravel keys routes by
 * method + URI, so the later registration silently replaced the earlier one and
 * the public endpoint became admin-only — which the Astro build and the
 * checkout both read unauthenticated. Nothing covered the public route, so the
 * whole suite stayed green.
 *
 * These tests pin down that the two paths stay distinct and keep their
 * respective auth postures.
 */

function makeConcertWithTicketType(): Concert
{
    $venue   = Venue::factory()->create();
    $concert = Concert::create(['venue_id' => $venue->id, 'date' => '2026-12-31']);

    ConcertTicketType::create([
        'concert_id' => $concert->id,
        'name'       => 'General Admission',
        'sort_order' => 0,
    ]);

    return $concert;
}

describe('ticket listing routes stay distinct', function () {
    it('serves the public ticket-type listing without authentication', function () {
        $concert = makeConcertWithTicketType();

        $this->getJson("/api/concerts/{$concert->id}/tickets")
            ->assertOk()
            ->assertJsonPath('data.0.name', 'General Admission');
    });

    it('requires authentication for the admin issued-ticket listing', function () {
        $concert = makeConcertWithTicketType();

        $this->getJson("/api/admin/concerts/{$concert->id}/tickets")
            ->assertUnauthorized();
    });

    it('forbids a non-admin from the admin issued-ticket listing', function () {
        $concert = makeConcertWithTicketType();
        $user    = User::factory()->create(['role' => 'member']);

        $this->actingAs($user, 'api')
            ->getJson("/api/admin/concerts/{$concert->id}/tickets")
            ->assertForbidden();
    });

    it('lets an admin read the admin issued-ticket listing', function () {
        $concert = makeConcertWithTicketType();
        $admin   = User::factory()->create(['role' => 'admin']);

        $this->actingAs($admin, 'api')
            ->getJson("/api/admin/concerts/{$concert->id}/tickets")
            ->assertOk();
    });
});
