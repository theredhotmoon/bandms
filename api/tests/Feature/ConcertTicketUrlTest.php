<?php

use App\Models\Concert;
use App\Models\ConcertLink;
use App\Models\ConcertTicketType;
use App\Models\SiteDirtyArea;
use App\Models\Ticket;
use App\Models\Venue;
use Illuminate\Support\Str;

// An external ticket shop is its own field; it used to be guessed from a
// link label matching /ticket|buy|bilet/i.

describe('concert ticket_url', function () {
    it('stores and returns an external ticket shop url', function () {
        $this->actingAsAdmin();
        $venue = Venue::factory()->create();

        $id = $this->postJson('/api/concerts', [
            'venue_id'   => $venue->id,
            'date'       => '2026-12-01',
            'ticket_url' => 'https://tickets.example.com/show',
        ])->assertCreated()
            ->assertJsonPath('data.ticket_url', 'https://tickets.example.com/show')
            ->json('data.id');

        $this->putJson("/api/concerts/{$id}", ['ticket_url' => null])
            ->assertSuccessful()
            ->assertJsonPath('data.ticket_url', null);
    });

    it('rejects a ticket_url that is not a url', function () {
        $this->actingAsAdmin();
        $venue = Venue::factory()->create();

        $this->postJson('/api/concerts', [
            'venue_id' => $venue->id, 'date' => '2026-12-01', 'ticket_url' => 'not a url',
        ])->assertUnprocessable()->assertJsonValidationErrors('ticket_url');
    });

    it('counts our own ticket types on the public list', function () {
        $concert = Concert::factory()->create();
        ConcertTicketType::create(['concert_id' => $concert->id, 'name' => 'GA', 'sort_order' => 0]);

        $this->getJson('/api/concerts')
            ->assertSuccessful()
            ->assertJsonPath('data.0.ticket_types_count', 1);

        $this->getJson("/api/concerts/{$concert->id}")
            ->assertJsonPath('data.ticket_types_count', 1);
    });
});

describe('ticket types and the public build', function () {
    // The concert page bakes whether we sell tickets; without a dirty mark a
    // new ticket type never reached it while auto-rebuild was on.
    it('marks concerts dirty when a ticket type is added or removed', function () {
        $this->actingAsAdmin();
        $concert = Concert::factory()->create();
        SiteDirtyArea::query()->delete();

        $typeId = $this->postJson("/api/concerts/{$concert->id}/tickets", ['name' => 'GA'])
            ->assertCreated()->json('data.id');
        expect(SiteDirtyArea::where('area', 'concerts')->exists())->toBeTrue();

        SiteDirtyArea::query()->delete();
        $this->deleteJson("/api/concerts/{$concert->id}/tickets/{$typeId}")->assertNoContent();
        expect(SiteDirtyArea::where('area', 'concerts')->exists())->toBeTrue();
    });

    it('says when each issued ticket was bought', function () {
        $this->actingAsAdmin();
        $concert = Concert::factory()->create();
        $type = ConcertTicketType::create(['concert_id' => $concert->id, 'name' => 'GA', 'sort_order' => 0]);
        Ticket::create([
            'uuid'                   => (string) Str::uuid(),
            'concert_ticket_type_id' => $type->id,
            'status'                 => 'active',
            'holder_email'           => 'fan@example.com',
            'holder_name'            => 'Fan',
        ]);

        $this->getJson("/api/admin/concerts/{$concert->id}/tickets")
            ->assertSuccessful()
            ->assertJsonPath('0.holder_email', 'fan@example.com')
            ->assertJsonStructure([['uuid', 'status', 'holder_name', 'holder_email', 'ticket_type', 'purchased_at']]);
    });
});

describe('migrating guessed ticket links', function () {
    it('moves the first ticket-looking link into ticket_url and keeps the rest', function () {
        $migration = require database_path('migrations/2026_10_27_000001_add_ticket_url_to_concerts.php');
        $migration->down();

        $concert = Concert::factory()->create(['date' => now()->addMonth()->toDateString()]);
        ConcertLink::create(['concert_id' => $concert->id, 'label' => 'Facebook Event', 'url' => 'https://fb.example/e']);
        ConcertLink::create(['concert_id' => $concert->id, 'label' => 'Kup bilety', 'url' => 'https://shop.example/a']);
        ConcertLink::create(['concert_id' => $concert->id, 'label' => 'Buy Tickets', 'url' => 'https://shop.example/b']);
        $past = Concert::factory()->create(['date' => now()->subMonth()->toDateString()]);
        ConcertLink::create(['concert_id' => $past->id, 'label' => 'Bilety', 'url' => 'https://shop.example/old']);

        $migration->up();

        expect($concert->fresh()->ticket_url)->toBe('https://shop.example/a')
            ->and($concert->links()->pluck('label')->all())->toBe(['Facebook Event', 'Buy Tickets']);
        // A past show's page lists the link under "Links"; it must stay a link.
        expect($past->fresh()->ticket_url)->toBeNull()
            ->and($past->links()->pluck('label')->all())->toBe(['Bilety']);
    });
});
