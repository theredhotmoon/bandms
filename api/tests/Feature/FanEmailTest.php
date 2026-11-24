<?php

use App\Models\Concert;
use App\Models\ConcertTicketType;
use App\Models\FanAccount;
use App\Models\FanSessionRow;
use App\Models\Order;
use App\Models\Ticket;
use App\Models\Venue;
use App\Support\FanEmail;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

/*
 * Production compares addresses with utf8mb4_unicode_ci, where `á` equals `a`
 * and a control character equals nothing. A fan session shows the orders and
 * tickets of its address, so "the same address" has to mean the same bytes.
 */

/** The address an attacker can receive mail at, and the one it collates equal to. */
function lookalike(): string
{
    return 'victim@gmáil.com';
}

function victim(): string
{
    return 'victim@gmail.com';
}

/** Give the address columns a collation that folds accents, capitals and control characters, as MySQL's does. */
function foldAddressesLikeMysql(): void
{
    $fold = fn (string $s) => strtolower(preg_replace('/[\x00-\x1F]/', '', strtr($s, ['á' => 'a'])));
    DB::connection()->getPdo()->sqliteCreateCollation('fan_ci', fn ($a, $b) => strcmp($fold($a), $fold($b)));

    Schema::table('fan_accounts', fn (Blueprint $t) => $t->string('email')->collation('fan_ci')->change());
    Schema::table('orders', fn (Blueprint $t) => $t->string('email')->collation('fan_ci')->change());
    Schema::table('tickets', fn (Blueprint $t) => $t->string('holder_email')->collation('fan_ci')->change());

    // The emulation itself: without it the tests below would pass on their own.
    DB::table('fan_accounts')->insert(['email' => 'prába@example.com', 'name' => 'probe']);
    expect(DB::table('fan_accounts')->where('email', 'praba@example.com')->count())->toBe(1);
    DB::table('fan_accounts')->delete();
}

function fanMailCount(): int
{
    return app('mailer')->getSymfonyTransport()->messages()->count();
}

function fanMagicKeys(): array
{
    $storage = (new ReflectionProperty(Cache::getStore(), 'storage'))->getValue(Cache::getStore());

    return array_values(array_filter(array_keys($storage), fn ($k) => str_contains($k, 'fan_magic:')));
}

function ticketHeldBy(string $email, ?int $fanId = null): Ticket
{
    $concert = Concert::create(['venue_id' => Venue::factory()->create()->id, 'date' => '2026-12-31']);
    $type    = ConcertTicketType::create(['concert_id' => $concert->id, 'name' => 'GA', 'sort_order' => 0]);

    return Ticket::create([
        'uuid'                   => (string) Str::uuid(),
        'concert_ticket_type_id' => $type->id,
        'status'                 => 'active',
        'holder_email'           => $email,
        'holder_name'            => 'Holder',
        'fan_account_id'         => $fanId,
    ]);
}

// ── the rule ───────────────────────────────────────────────────────────────

it('accepts only printable ASCII addresses', function (mixed $email, bool $ok) {
    expect(Validator::make(['email' => $email], ['email' => FanEmail::rules()])->passes())->toBe($ok);
})->with([
    'plain'             => ['fan@example.com', true],
    'quote and tag'     => ["o'brien+tag@example.com", true],
    'accented local'    => ['vá@example.com', false],
    'accented domain'   => ['victim@gmáil.com', false],
    'control character' => ["v\x01a@example.com", false],
    'trailing newline'  => ["fan@example.com\n", false],
    'zero-width space'  => ["f\u{200B}an@example.com", false],
    'Kelvin sign'       => ["mar\u{212A}@example.com", false],
    'space'             => ['fan @example.com', false],
    'no domain'         => ['not-an-address', false],
    'array'             => [['fan@example.com'], false],
    'empty'             => ['', false],
]);

it('compares addresses exactly, whatever the capitals', function () {
    expect(FanEmail::same('Fan@Example.com ', 'fan@example.com'))->toBeTrue();
    expect(FanEmail::same(lookalike(), victim()))->toBeFalse();
    expect(FanEmail::same("v\x01a@x.com", 'va@x.com'))->toBeFalse();
    // Unicode lowercasing folds the Kelvin sign into "k"; ours must not.
    expect(FanEmail::same("mar\u{212A}@x.com", 'mark@x.com'))->toBeFalse();
    expect(FanEmail::same(null, null))->toBeFalse();
    expect(FanEmail::same('', ''))->toBeFalse();
    expect(FanEmail::same(null, 'fan@example.com'))->toBeFalse();
});

it('refuses a non-ASCII address on magic-link and register, in the fan\'s language', function () {
    $this->postJson('/api/fan/auth/magic-link', ['email' => lookalike()])->assertStatus(422)->assertJsonValidationErrors('email');

    $pl = $this->withHeader('Accept-Language', 'pl')
        ->postJson('/api/fan/auth/register', ['email' => lookalike(), 'password' => 'correct horse'])
        ->assertStatus(422)->assertJsonValidationErrors('email');

    foreach ($pl->json('errors.email') as $message) {
        expect($message)->toContain('Pole')->not->toContain('field');
    }
    expect(FanAccount::count())->toBe(0);
    expect(fanMailCount())->toBe(0);
});

// ── login ──────────────────────────────────────────────────────────────────

it('answers a non-ASCII address at login like any other failure', function () {
    FanAccount::factory()->create(['email' => victim(), 'password_hash' => Hash::make('correct horse')]);

    $ordinary = $this->postJson('/api/fan/auth/login', ['email' => victim(), 'password' => 'nope'])->assertStatus(422);

    Hash::spy();
    $odd = $this->postJson('/api/fan/auth/login', ['email' => lookalike(), 'password' => 'correct horse'])->assertStatus(422);

    expect($odd->json())->toBe($ordinary->json());
    expect($odd->json('code'))->toBe('login_failed');
    // The dummy hash is still checked, so the miss costs the same time.
    Hash::shouldHaveReceived('check')->once();
});

it('opens no account through a spelling the collation folds together', function () {
    foldAddressesLikeMysql();
    FanAccount::factory()->create(['email' => victim(), 'password_hash' => Hash::make('correct horse')]);
    FanAccount::factory()->create(['email' => 'prá@example.com', 'password_hash' => Hash::make('correct horse')]);

    foreach ([lookalike(), "victim@gm\x01ail.com", 'pra@example.com'] as $spelling) {
        $this->postJson('/api/fan/auth/login', ['email' => $spelling, 'password' => 'correct horse'])
            ->assertStatus(422)->assertJsonPath('code', 'login_failed');
    }

    expect(FanSessionRow::count())->toBe(0);
    expect(FanAccount::findByEmail('pra@example.com'))->toBeNull();
    expect(FanAccount::findByEmail(' Victim@Gmail.com')?->email)->toBe(victim());
});

it('gives a folded spelling no attempts of its own against the account', function () {
    foldAddressesLikeMysql();
    FanAccount::factory()->create(['email' => victim(), 'password_hash' => Hash::make('correct horse')]);

    foreach (range(1, 10) as $i) {
        $this->withServerVariables(['REMOTE_ADDR' => "10.1.0.$i"])
            ->postJson('/api/fan/auth/login', ['email' => victim(), 'password' => 'nope'])->assertStatus(422);
    }

    $this->withServerVariables(['REMOTE_ADDR' => '10.1.0.50'])
        ->postJson('/api/fan/auth/login', ['email' => victim(), 'password' => 'correct horse'])->assertStatus(429);
    $this->withServerVariables(['REMOTE_ADDR' => '10.1.0.51'])
        ->postJson('/api/fan/auth/login', ['email' => "victim@gm\x01ail.com", 'password' => 'correct horse'])->assertStatus(422);
    expect(FanSessionRow::count())->toBe(0);
});

it('still finds an account stored with capitals', function () {
    foldAddressesLikeMysql();
    FanAccount::factory()->create(['email' => 'Fan@Example.com', 'password_hash' => Hash::make('correct horse')]);

    $this->postJson('/api/fan/auth/login', ['email' => 'fan@example.com', 'password' => 'correct horse'])->assertOk();
    $this->postJson('/api/fan/auth/magic-link', ['email' => 'FAN@example.com'])->assertOk();

    expect(FanAccount::count())->toBe(1);
});

// ── find or create ─────────────────────────────────────────────────────────

it('answers as usual, mails nothing and issues no token when a lookalike holds the address', function (string $path, array $extra) {
    config(['app.debug' => false]);
    foldAddressesLikeMysql();
    $holder = FanAccount::factory()->create(['email' => lookalike()]);

    $usual = $this->postJson($path, ['email' => 'someone@example.com'] + $extra)->assertOk();
    $mails = fanMailCount();
    $keys  = fanMagicKeys();

    Log::spy();
    $blocked = $this->postJson($path, ['email' => victim()] + $extra)->assertOk();

    expect($blocked->json())->toBe($usual->json());
    expect(fanMailCount())->toBe($mails);
    expect(fanMagicKeys())->toBe($keys);
    expect(FanAccount::where('email', victim())->pluck('email')->all())->toBe([lookalike()]);
    Log::shouldHaveReceived('warning')->once()->withArgs(fn ($m) => str_contains($m, (string) $holder->id)
        && ! str_contains($m, 'victim') && ! str_contains($m, '@'));
})->with([
    'magic-link' => ['/api/fan/auth/magic-link', []],
    'register'   => ['/api/fan/auth/register', ['password' => 'correct horse']],
]);

it('keeps answering as usual with debug on, with no link to serve', function () {
    config(['app.debug' => true]);
    foldAddressesLikeMysql();
    FanAccount::factory()->create(['email' => lookalike()]);

    $this->postJson('/api/fan/auth/magic-link', ['email' => victim()])->assertOk()->assertJsonMissingPath('dev_link');
});

it('survives a parallel first request for the same address', function (string $path, array $extra) {
    // The other request inserts between our lookup and our insert.
    FanAccount::creating(function (FanAccount $fan): void {
        DB::table('fan_accounts')->insert(['email' => $fan->email, 'name' => 'winner']);
    });

    $this->postJson($path, ['email' => 'first@example.com'] + $extra)->assertOk();

    expect(FanAccount::sole()->name)->toBe('winner');
    expect(fanMailCount())->toBe(1);
})->with([
    'magic-link' => ['/api/fan/auth/magic-link', []],
    'register'   => ['/api/fan/auth/register', ['password' => 'correct horse']],
]);

// ── what a session shows ───────────────────────────────────────────────────

it('shows a fan only the orders placed with exactly their address', function () {
    foldAddressesLikeMysql();
    $fan = FanAccount::factory()->create(['email' => lookalike()]);
    Order::factory()->create(['email' => victim(), 'currency' => 'EUR']);
    Order::factory()->create(['email' => lookalike(), 'currency' => 'PLN']);

    $res = $this->withToken(fanToken($fan))->getJson('/api/fan/orders')->assertOk();

    expect($res->json('*.currency'))->toBe(['PLN']);
    expect(array_is_list($res->json()))->toBeTrue();
});

it('shows an order whatever capitals the buyer typed', function () {
    foldAddressesLikeMysql();
    $fan = FanAccount::factory()->create(['email' => victim()]);
    Order::factory()->create(['email' => 'Victim@Gmail.com']);

    expect($this->withToken(fanToken($fan))->getJson('/api/fan/orders')->assertOk()->json())->toHaveCount(1);
});

it('shows a fan only the tickets held by exactly their address, or tied to their account', function () {
    foldAddressesLikeMysql();
    $fan = FanAccount::factory()->create(['email' => lookalike()]);
    ticketHeldBy(victim());
    $held  = ticketHeldBy('VICTIM@GMáil.com');
    $owned = ticketHeldBy('someone-else@example.com', $fan->id);

    $res = $this->withToken(fanToken($fan))->getJson('/api/fan/tickets')->assertOk();

    expect($res->json('*.uuid'))->toEqualCanonicalizing([$held->uuid, $owned->uuid]);
    expect(array_is_list($res->json()))->toBeTrue();
});
