<?php

use App\Models\FanAccount;
use App\Models\FanIdentity;
use App\Models\FanSessionRow;
use App\Support\FanMagicToken;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\ClientException;
use GuzzleHttp\Exception\ConnectException;
use GuzzleHttp\Handler\MockHandler;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Middleware;
use GuzzleHttp\Psr7\Request as GuzzleRequest;
use GuzzleHttp\Psr7\Response as GuzzleResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\FacebookProvider;
use Laravel\Socialite\Two\GoogleProvider;
use Laravel\Socialite\Two\User as SocialiteUser;

const FAN_SOCIAL_COOKIE = 'fan_oauth_state';

/** What a provider answers; `$verified` and `$hd` (hosted domain) are Google's own. */
function fanSocialUser(mixed $id, mixed $email, mixed $verified = true, mixed $hd = null): SocialiteUser
{
    $raw = ['sub' => $id, 'email' => $email, 'email_verified' => $verified, 'name' => 'Provider Display Name'];
    $raw += $hd === null ? [] : ['hd' => $hd];

    return (new SocialiteUser)->setRaw($raw)->map(['id' => $id, 'email' => $email, 'name' => 'Provider Display Name']);
}

/** The real driver with only user() replaced: building the redirect URL makes no HTTP call. */
function fanSocialDriver(string $provider, SocialiteUser|Throwable|null $answer): Mockery\MockInterface
{
    $class  = ['google' => GoogleProvider::class, 'facebook' => FacebookProvider::class][$provider];
    $driver = Mockery::mock($class, [request(), 'client-id', 'client-secret', 'https://band.example/cb'])
        ->makePartial()->shouldAllowMockingProtectedMethods();

    match (true) {
        $answer === null              => $driver->shouldNotReceive('user'),
        $answer instanceof Throwable  => $driver->shouldReceive('user')->andThrow($answer),
        default                       => $driver->shouldReceive('user')->andReturn($answer),
    };
    Socialite::swap($factory = Mockery::mock(Laravel\Socialite\Contracts\Factory::class));
    $factory->shouldReceive('driver')->with($provider)->andReturn($driver);

    return $driver;
}

/** What Guzzle throws for an answer the provider refused with. */
function fanSocialRefusal(int $status, string $body): ClientException
{
    return new ClientException(
        'https://provider.example/token?secret=secret-token',
        new GuzzleRequest('POST', 'https://provider.example/token?secret=secret-token'),
        new GuzzleResponse($status, [], $body),
    );
}

/** Press the button: the state the provider will be sent, and will send back. */
function fanSocialStart(string $provider, array $query = []): string
{
    $res = test()->get("/api/fan/auth/$provider/redirect?" . http_build_query($query))->assertStatus(302);
    parse_str((string) parse_url($res->headers->get('Location'), PHP_URL_QUERY), $q);

    return $q['state'];
}

function fanSocialReturn(string $provider, string $state, array $query = ['code' => 'abc'], ?string $cookie = null): TestResponse
{
    return test()->withUnencryptedCookie(FAN_SOCIAL_COOKIE, $cookie ?? $state)
        ->get("/api/fan/auth/$provider/callback?" . http_build_query(['state' => $state] + $query));
}

/** The whole round trip for one provider answer. */
function fanSocialTrip(string $provider, SocialiteUser|Throwable|null $answer, array $query = []): TestResponse
{
    fanSocialDriver($provider, $answer);

    return fanSocialReturn($provider, fanSocialStart($provider, $query));
}

/** The /account query string a callback ended on. */
function fanSocialQuery(TestResponse $res): array
{
    $res->assertStatus(302);
    $location = $res->headers->get('Location');
    expect($location)->toStartWith('https://band.example/account?');
    parse_str((string) parse_url($location, PHP_URL_QUERY), $q);

    return $q;
}

function fanSocialMails(): array
{
    return app('mailer')->getSymfonyTransport()->messages()->all();
}

function fanSocialMailedToken(): string
{
    $mails = fanSocialMails();
    preg_match('/token=([A-Za-z0-9]{64})/', quoted_printable_decode(end($mails)->toString()), $m);

    return $m[1];
}

function fanSocialClaim(): array
{
    $claim = Str::random(64);

    return [$claim, hash('sha256', $claim)];
}

/** Another request links the identity while this one is about to. */
function fanSocialRival(FanAccount $winner, string $provider, string $id): void
{
    FanIdentity::creating(function () use ($winner, $provider, $id) {
        if (! DB::table('fan_identities')->where(['provider' => $provider, 'provider_user_id' => $id])->exists()) {
            DB::table('fan_identities')->insert([
                'fan_account_id' => $winner->id, 'provider' => $provider, 'provider_user_id' => $id,
                'created_at' => now(), 'updated_at' => now(),
            ]);
        }
    });
}

beforeEach(function () {
    RateLimiter::clear(md5('fan-social-redirect127.0.0.1'));
    RateLimiter::clear('fan-verify' . sha1('|127.0.0.1'));
    config([
        'newsletter.frontend_url'         => 'https://band.example/',
        'services.google.client_id'       => 'g-id',
        'services.google.client_secret'   => 'g-secret',
        'services.google.redirect'        => 'https://band.example/api/fan/auth/google/callback',
        'services.facebook.client_id'     => 'f-id',
        'services.facebook.client_secret' => 'f-secret',
        'services.facebook.redirect'      => 'https://band.example/api/fan/auth/facebook/callback',
    ]);
});

describe('the redirect', function () {
    it('redirects with a state it also sets as a cookie and remembers', function () {
        [, $hash] = fanSocialClaim();
        $res = $this->get('/api/fan/auth/google/redirect?' . http_build_query([
            'return_to' => '/en/news/x', 'lang' => 'pl', 'claim_hash' => $hash,
        ]))->assertStatus(302);

        expect($res->headers->get('Location'))->toStartWith('https://accounts.google.com/');
        parse_str((string) parse_url($res->headers->get('Location'), PHP_URL_QUERY), $q);
        expect($q['state'])->toMatch('/^[A-Za-z0-9]{40}$/')
            ->and($q['client_id'])->toBe('g-id')
            ->and($q['redirect_uri'])->toBe('https://band.example/api/fan/auth/google/callback');

        $cookie = $res->getCookie(FAN_SOCIAL_COOKIE, false);
        expect($cookie->getValue())->toBe($q['state'])
            ->and($cookie->isHttpOnly())->toBeTrue()
            ->and($cookie->isSecure())->toBeTrue()
            ->and($cookie->getSameSite())->toBe('lax')
            ->and($cookie->getPath())->toBe('/api/fan/auth')
            ->and($cookie->getDomain())->toBeNull()
            ->and($cookie->getExpiresTime())->toBeGreaterThan(now()->addMinutes(9)->timestamp)
            ->and($cookie->getExpiresTime())->toBeLessThanOrEqual(now()->addMinutes(10)->timestamp);

        expect(Cache::get("fan_oauth:{$q['state']}"))->toBe([
            'provider' => 'google', 'return_to' => '/en/news/x', 'lang' => 'pl', 'claim_hash' => $hash,
        ]);
    });

    it('sets a cookie a plain http site can use', function () {
        config(['newsletter.frontend_url' => 'http://localhost:8081']);

        $res = $this->get('/api/fan/auth/google/redirect', ['X-Forwarded-Proto' => 'https']);

        expect($res->getCookie(FAN_SOCIAL_COOKIE, false)->isSecure())->toBeFalse();
    });

    it('asks for the email and an id, nothing else', function () {
        parse_str((string) parse_url($this->get('/api/fan/auth/google/redirect')->headers->get('Location'), PHP_URL_QUERY), $google);
        parse_str((string) parse_url($this->get('/api/fan/auth/facebook/redirect')->headers->get('Location'), PHP_URL_QUERY), $facebook);

        expect($google['scope'])->toBe('openid email')
            ->and($facebook['scope'])->toBe('email');
    });

    it('asks Facebook again for an email the fan once declined to share', function () {
        parse_str((string) parse_url($this->get('/api/fan/auth/facebook/redirect')->headers->get('Location'), PHP_URL_QUERY), $facebook);
        parse_str((string) parse_url($this->get('/api/fan/auth/google/redirect')->headers->get('Location'), PHP_URL_QUERY), $google);

        expect($facebook['auth_type'])->toBe('rerequest')->and($google)->not->toHaveKey('auth_type');
    });

    it('answers a provider with no keys with the usual redirect, starting nothing', function () {
        config(['services.google.client_secret' => '']);

        $res = $this->get('/api/fan/auth/google/redirect?lang=pl');

        expect(fanSocialQuery($res))->toBe(['auth_error' => 'failed', 'lang' => 'pl'])
            ->and($res->getCookie(FAN_SOCIAL_COOKIE, false))->toBeNull();
        expect(fanSocialQuery($this->get('/api/fan/auth/google/redirect?lang[]=pl')))->toBe(['auth_error' => 'failed']);
    });

    it('redirects with failed when it cannot start, logging the class alone', function () {
        Log::spy();
        Socialite::swap($factory = Mockery::mock(Laravel\Socialite\Contracts\Factory::class));
        $factory->shouldReceive('driver')->andThrow(new RuntimeException('secret-token'));

        $res = $this->get('/api/fan/auth/google/redirect?lang=pl');

        expect(fanSocialQuery($res))->toBe(['auth_error' => 'failed', 'lang' => 'pl'])
            ->and($res->getCookie(FAN_SOCIAL_COOKIE, false))->toBeNull();
        Log::shouldHaveReceived('warning')->once()->withArgs(fn (...$args) => str_contains($args[0], 'google')
            && str_contains($args[0], RuntimeException::class)
            && ! str_contains(json_encode($args), 'secret-token'));
    });

    it('404s for a provider it has never heard of', function () {
        $this->get('/api/fan/auth/twitter/redirect')->assertStatus(404);
        $this->get('/api/fan/auth/twitter/callback')->assertStatus(404);
    });

    it('drops a return path, language or claim hash it cannot use', function (string $query) {
        parse_str((string) parse_url($this->get("/api/fan/auth/google/redirect?$query")->assertStatus(302)->headers->get('Location'), PHP_URL_QUERY), $q);

        expect(Cache::get("fan_oauth:{$q['state']}"))->toBe([
            'provider' => 'google', 'return_to' => null, 'lang' => null, 'claim_hash' => null,
        ]);
    })->with([
        'absent'   => [''],
        'invalid'  => ['return_to=//evil.example&lang=xx&claim_hash=' . strtoupper(str_repeat('ab', 32))],
        'short'    => ['return_to=news&lang=&claim_hash=abc'],
        'not UTF-8' => ['return_to=/%FF'],
        'arrays'   => ['return_to[]=/en&lang[]=pl&claim_hash[]=' . str_repeat('a', 64)],
    ]);
});

describe('a callback that signs in', function () {
    it('signs in a fan whose identity is already linked', function () {
        $fan = FanAccount::factory()->create(['email' => 'linked@gmail.com']);
        FanIdentity::create(['fan_account_id' => $fan->id, 'provider' => 'google', 'provider_user_id' => '42']);

        $res = fanSocialTrip('google', fanSocialUser('42', 'linked@gmail.com'));
        $q   = fanSocialQuery($res);

        expect(array_keys($q))->toBe(['token'])
            ->and(FanSessionRow::count())->toBe(0)
            ->and(fanSocialMails())->toBeEmpty();
        $this->getJson('/api/fan/auth/verify?token=' . $q['token'])->assertOk()
            ->assertJsonPath('fan.id', $fan->id)->assertJsonPath('linked', null);
        expect(FanSessionRow::sole()->method)->toBe('google');
    });

    it('signs in as the linked fan whatever email the provider now reports', function (mixed $email) {
        $fan   = FanAccount::factory()->create(['email' => 'linked@gmail.com']);
        $other = FanAccount::factory()->create(['email' => 'other@gmail.com', 'email_verified_at' => null]);
        FanIdentity::create(['fan_account_id' => $fan->id, 'provider' => 'google', 'provider_user_id' => '42']);

        $q = fanSocialQuery(fanSocialTrip('google', fanSocialUser('42', $email)));

        expect(FanMagicToken::pull($q['token'])['fan_id'])->toBe($fan->id)
            ->and(FanIdentity::sole()->fan_account_id)->toBe($fan->id)
            ->and($other->fresh()->email_verified_at)->toBeNull()
            ->and(FanAccount::count())->toBe(2);
    })->with(['another account\'s' => ['other@gmail.com'], 'a new one' => ['new@gmail.com'], 'none' => [null]]);

    it('does not take another provider\'s identity for this one', function () {
        $fan = FanAccount::factory()->create(['email' => 'linked@gmail.com']);
        FanIdentity::create(['fan_account_id' => $fan->id, 'provider' => 'google', 'provider_user_id' => '42']);

        expect(fanSocialQuery(fanSocialTrip('facebook', fanSocialUser('42', 'someone@gmail.com'))))
            ->toBe(['auth_notice' => 'confirm_email']);
    });

    it('takes only the exact id for the linked one, whatever the database calls equal', function () {
        DB::statement('DROP TABLE fan_identities');
        DB::statement('CREATE TABLE fan_identities (id INTEGER PRIMARY KEY, fan_account_id INTEGER, provider TEXT,
            provider_user_id TEXT COLLATE NOCASE, created_at TEXT, updated_at TEXT, UNIQUE(provider, provider_user_id))');
        $fan = FanAccount::factory()->create();
        FanIdentity::create(['fan_account_id' => $fan->id, 'provider' => 'google', 'provider_user_id' => 'abc']);

        expect(fanSocialQuery(fanSocialTrip('google', fanSocialUser('ABC', 'new@gmail.com'))))->toBe(['auth_error' => 'failed']);
        expect(FanIdentity::sole()->fan_account_id)->toBe($fan->id);
    });

    it('creates and links an account when Google vouches for the email', function (mixed $verified) {
        $q = fanSocialQuery(fanSocialTrip('google', fanSocialUser('42', 'New.Fan@Gmail.com', $verified)));

        expect($q)->toHaveKey('token');
        $fan = FanAccount::sole();
        expect($fan->email)->toBe('new.fan@gmail.com')
            ->and($fan->name)->toBe('new.fan')
            ->and($fan->display_name)->toBeNull()
            ->and($fan->email_verified_at)->not->toBeNull()
            ->and(FanIdentity::sole()->only(['fan_account_id', 'provider', 'provider_user_id']))
            ->toBe(['fan_account_id' => $fan->id, 'provider' => 'google', 'provider_user_id' => '42'])
            ->and(fanSocialMails())->toBeEmpty()
            ->and(FanSessionRow::count())->toBe(0);

        $this->getJson('/api/fan/auth/verify?token=' . $q['token'])->assertOk()->assertJsonPath('fan.providers', ['google']);
        expect(FanSessionRow::sole()->method)->toBe('google');
    })->with(['boolean' => [true], 'string' => ['true']]);

    it('links to the existing account with that email when Google vouches', function () {
        $fan = FanAccount::factory()->create(['email' => 'known@gmail.com', 'email_verified_at' => null]);

        $q = fanSocialQuery(fanSocialTrip('google', fanSocialUser('42', 'KNOWN@gmail.com')));

        expect(FanMagicToken::pull($q['token'])['fan_id'])->toBe($fan->id)
            ->and(FanAccount::count())->toBe(1)
            ->and(FanIdentity::sole()->fan_account_id)->toBe($fan->id)
            ->and($fan->fresh()->email_verified_at)->not->toBeNull();
    });

    it('takes Google at its word for its own mail and a domain it hosts', function (string $email, mixed $hd) {
        expect(fanSocialQuery(fanSocialTrip('google', fanSocialUser('42', $email, true, $hd))))->toHaveKey('token');
        expect(FanIdentity::count())->toBe(1)->and(fanSocialMails())->toBeEmpty();
    })->with([
        'gmail'         => ['fan@gmail.com', null],
        'googlemail'    => ['Fan@GoogleMail.com', null],
        'hosted'        => ['fan@band.example', 'band.example'],
        'hosted, caps'  => ['Fan@Band.example', 'BAND.Example'],
    ]);

    it('signs in a linked Google account whatever domain it is on', function () {
        $fan = FanAccount::factory()->create(['email' => 'fan@outlook.example']);
        FanIdentity::create(['fan_account_id' => $fan->id, 'provider' => 'google', 'provider_user_id' => '42']);

        expect(fanSocialQuery(fanSocialTrip('google', fanSocialUser('42', 'fan@outlook.example'))))->toHaveKey('token');
    });

    it('keeps the date an email was first proven', function () {
        $fan = FanAccount::factory()->create(['email' => 'known@gmail.com', 'email_verified_at' => '2026-01-01 10:00:00']);

        fanSocialTrip('google', fanSocialUser('42', 'known@gmail.com'));

        expect($fan->fresh()->email_verified_at->toDateTimeString())->toBe('2026-01-01 10:00:00');
    });

    it('mints a token that lives five minutes and carries the method', function () {
        $q = fanSocialQuery(fanSocialTrip('google', fanSocialUser('42', 'new@gmail.com')));

        expect(Cache::get('fan_magic:' . $q['token']))->toMatchArray(['method' => 'google', 'identity' => null, 'password_hash' => null]);
        $this->travel(6)->minutes();
        $this->getJson('/api/fan/auth/verify?token=' . $q['token'])->assertStatus(401);
    });

    it('carries a cleaned return path and the language through to the account URL', function () {
        $res = fanSocialTrip('google', fanSocialUser('42', 'new@gmail.com'), ['return_to' => '/en/news/x', 'lang' => 'pl']);
        expect($res->headers->get('Location'))->toContain('&return=%2Fen%2Fnews%2Fx')->toEndWith('&lang=pl');

        $res = fanSocialTrip('google', fanSocialUser('42', 'new@gmail.com'), ['return_to' => '//evil.example']);
        expect(fanSocialQuery($res))->not->toHaveKeys(['return', 'lang']);
    });

    it('accepts an id that arrives as a number', function () {
        fanSocialTrip('google', fanSocialUser(42, 'new@gmail.com'));

        expect(FanIdentity::sole()->provider_user_id)->toBe('42');
    });

    it('stores nothing from the provider but its id', function () {
        fanSocialTrip('google', fanSocialUser('42', 'new@gmail.com'));

        $fan = FanAccount::sole();
        expect($fan->name)->toBe('new')->and($fan->display_name)->toBeNull();
        expect(json_encode([$fan->getAttributes(), FanIdentity::sole()->getAttributes()]))->not->toContain('Provider Display Name');
    });

    it('survives losing the race to link the same identity', function () {
        $fan = FanAccount::factory()->create(['email' => 'known@gmail.com']);
        fanSocialRival($fan, 'google', '42');

        $q = fanSocialQuery(fanSocialTrip('google', fanSocialUser('42', 'known@gmail.com')));

        expect(FanMagicToken::pull($q['token'])['fan_id'])->toBe($fan->id)
            ->and(FanIdentity::count())->toBe(1);
    });

    it('never re-points an identity another fan got first', function () {
        $winner = FanAccount::factory()->create(['email' => 'winner@gmail.com']);
        fanSocialRival($winner, 'google', '42');

        $q = fanSocialQuery(fanSocialTrip('google', fanSocialUser('42', 'late@gmail.com')));

        expect(FanIdentity::sole()->fan_account_id)->toBe($winner->id)
            ->and(FanMagicToken::pull($q['token'])['fan_id'])->toBe($winner->id);
    });
});

describe('an email the provider does not vouch for', function () {
    it('does not trust a Google email flagged unverified', function (mixed $verified) {
        FanAccount::factory()->create(['email' => 'known@gmail.com', 'email_verified_at' => null]);

        $q = fanSocialQuery(fanSocialTrip('google', fanSocialUser('42', 'known@gmail.com', $verified)));

        expect($q)->toBe(['auth_notice' => 'confirm_email'])
            ->and(FanIdentity::count())->toBe(0)
            ->and(FanAccount::sole()->email_verified_at)->toBeNull()
            ->and(fanSocialMails())->toHaveCount(1);
    })->with(['false' => [false], 'the string' => ['false'], 'absent' => [null], 'one' => [1]]);

    it('does not trust a verified Google email on a domain Google does not run', function (string $email, mixed $hd) {
        [$claim, $hash] = fanSocialClaim();
        $fan = FanAccount::factory()->create(['email' => $email, 'email_verified_at' => null]);

        expect(fanSocialQuery(fanSocialTrip('google', fanSocialUser('42', $email, true, $hd), ['claim_hash' => $hash])))
            ->toBe(['auth_notice' => 'confirm_email']);
        expect(FanIdentity::count())->toBe(0)
            ->and($fan->fresh()->email_verified_at)->toBeNull()
            ->and(fanSocialMails())->toHaveCount(1);

        $this->getJson('/api/fan/auth/verify?token=' . fanSocialMailedToken() . '&claim=' . $claim)->assertOk()->assertJsonPath('linked', 'google');
    })->with([
        'no hosted domain'      => ['fan@outlook.example', null],
        'empty hosted domain'   => ['fan@outlook.example', ''],
        'another hosted domain' => ['fan@outlook.example', 'band.example'],
        'a parent domain'       => ['fan@mail.band.example', 'band.example'],
        'a suffix of it'        => ['fan@evilband.example', 'band.example'],
        'not a string'          => ['fan@band.example', ['band.example']],
        'true'                  => ['fan@band.example', true],
        'gmail as a subdomain'  => ['fan@gmail.com.example', null],
        'gmail as a suffix'     => ['fan@notgmail.com', null],
        'below gmail'           => ['fan@evil.gmail.com', null],
    ]);

    it('needs email_verified on a hosted domain too', function () {
        expect(fanSocialQuery(fanSocialTrip('google', fanSocialUser('42', 'fan@band.example', false, 'band.example'))))
            ->toBe(['auth_notice' => 'confirm_email']);
    });

    it('mails one fan at most five links in fifteen minutes, and says nothing of it', function () {
        foreach (range(1, 5) as $i) {
            fanSocialTrip('facebook', fanSocialUser("77{$i}", 'fan@gmail.com'));
        }
        expect(fanSocialMails())->toHaveCount(5);

        expect(fanSocialQuery(fanSocialTrip('facebook', fanSocialUser('776', 'fan@gmail.com'), ['lang' => 'pl'])))
            ->toBe(['auth_notice' => 'confirm_email', 'lang' => 'pl']);
        expect(fanSocialMails())->toHaveCount(5);

        fanSocialTrip('facebook', fanSocialUser('88', 'other@gmail.com'));
        expect(fanSocialMails())->toHaveCount(6);
        $this->postJson('/api/fan/auth/magic-link', ['email' => 'fan@gmail.com'])->assertOk();
        expect(fanSocialMails())->toHaveCount(7);

        $this->travel(16)->minutes();
        fanSocialTrip('facebook', fanSocialUser('776', 'fan@gmail.com'));
        expect(fanSocialMails())->toHaveCount(8);
    });

    it('logs a link it could not issue', function () {
        Cache::setStore(new class extends Illuminate\Cache\ArrayStore
        {
            public function put($key, $value, $seconds)
            {
                if (str_starts_with($key, 'fan_magic:')) {
                    throw new RuntimeException('cache down at secret-token');
                }

                return parent::put($key, $value, $seconds);
            }
        });
        Log::spy();

        expect(fanSocialQuery(fanSocialTrip('facebook', fanSocialUser('77', 'fan@gmail.com'))))->toBe(['auth_error' => 'failed']);
        Log::shouldHaveReceived('warning')->once()->withArgs(fn ($m) => str_contains($m, 'RuntimeException') && ! str_contains($m, 'secret-token'));
        expect(fanSocialMails())->toBeEmpty();
    });

    it('does not trust a verified Google email once config says so', function () {
        config(['fan_auth.providers.google.trust_email' => false]);

        expect(fanSocialQuery(fanSocialTrip('google', fanSocialUser('42', 'known@gmail.com'))))->toBe(['auth_notice' => 'confirm_email']);
    });

    it('mails a link instead of signing in on a first Facebook sign-in', function () {
        $q = fanSocialQuery(fanSocialTrip('facebook', fanSocialUser('77', 'Fan@Gmail.com')));

        expect($q)->toBe(['auth_notice' => 'confirm_email'])
            ->and(FanSessionRow::count())->toBe(0)
            ->and(FanIdentity::count())->toBe(0)
            ->and(FanAccount::sole()->email_verified_at)->toBeNull();
        $mails = fanSocialMails();
        expect($mails)->toHaveCount(1)
            ->and($mails[0]->getEnvelope()->getRecipients()[0]->getAddress())->toBe('fan@gmail.com')
            ->and($mails[0]->getOriginalMessage()->getSubject())->toBe('Your Sign-In Link')
            ->and($mails[0]->getOriginalMessage()->getTextBody())
            ->toBe('Sign in to your fan account: https://band.example/account?token=' . fanSocialMailedToken());
    });

    it('answers the same for an address it knows', function () {
        FanAccount::factory()->create(['email' => 'known@gmail.com', 'email_verified_at' => now()]);

        $known   = fanSocialTrip('facebook', fanSocialUser('77', 'known@gmail.com'));
        $unknown = fanSocialTrip('facebook', fanSocialUser('78', 'unknown@gmail.com'));

        expect($known->headers->get('Location'))->toBe($unknown->headers->get('Location'));
    });

    it('signs in directly with Facebook if the band trusts it', function () {
        config(['fan_auth.providers.facebook.trust_email' => true]);

        $q = fanSocialQuery(fanSocialTrip('facebook', fanSocialUser('77', 'fan@gmail.com')));

        expect(FanMagicToken::pull($q['token'])['method'])->toBe('facebook')
            ->and(FanIdentity::sole()->provider)->toBe('facebook')
            ->and(fanSocialMails())->toBeEmpty();
    });

    it('links Facebook when that mail is opened with the claim', function () {
        [$claim, $hash] = fanSocialClaim();
        fanSocialTrip('facebook', fanSocialUser('77', 'fan@gmail.com'), ['claim_hash' => $hash]);
        expect(FanIdentity::count())->toBe(0);

        $this->getJson('/api/fan/auth/verify?token=' . fanSocialMailedToken() . '&claim=' . $claim)->assertOk()
            ->assertJsonPath('linked', 'facebook')
            ->assertJsonPath('password_set', false)
            ->assertJsonPath('fan.providers', ['facebook']);
        expect(FanSessionRow::sole()->method)->toBe('link');

        $q = fanSocialQuery(fanSocialTrip('facebook', fanSocialUser('77', 'fan@gmail.com')));
        expect(FanMagicToken::pull($q['token'])['fan_id'])->toBe(FanAccount::sole()->id)
            ->and(fanSocialMails())->toHaveCount(1);
    });

    it('signs in without linking when the mail is opened without the claim', function (string $claim) {
        [, $hash] = fanSocialClaim();
        fanSocialTrip('facebook', fanSocialUser('77', 'fan@gmail.com'), ['claim_hash' => $hash]);

        $this->getJson('/api/fan/auth/verify?token=' . fanSocialMailedToken() . $claim)->assertOk()->assertJsonPath('linked', null);

        expect(FanIdentity::count())->toBe(0)->and(FanSessionRow::count())->toBe(1);
    })->with(['none' => [''], 'wrong' => ['&claim=' . str_repeat('a', 64)], 'an array' => ['&claim[]=x']]);

    it('parks nothing without a claim hash', function () {
        fanSocialTrip('facebook', fanSocialUser('77', 'fan@gmail.com'));

        expect(Cache::get('fan_magic:' . fanSocialMailedToken()))
            ->toMatchArray(['method' => 'link', 'identity' => null, 'claim_hash' => null]);
    });

    it('never re-points an identity another fan linked while the mail was waiting', function () {
        [$claim, $hash] = fanSocialClaim();
        fanSocialTrip('facebook', fanSocialUser('77', 'fan@gmail.com'), ['claim_hash' => $hash]);
        $other = FanAccount::factory()->create(['email' => 'other@gmail.com']);
        FanIdentity::create(['fan_account_id' => $other->id, 'provider' => 'facebook', 'provider_user_id' => '77']);

        $this->getJson('/api/fan/auth/verify?token=' . fanSocialMailedToken() . '&claim=' . $claim)->assertOk()
            ->assertJsonPath('linked', null)
            ->assertJsonPath('fan.email', 'fan@gmail.com')
            ->assertJsonPath('fan.providers', []);

        expect(FanIdentity::sole()->fan_account_id)->toBe($other->id);
    });

    it('never re-points an identity another fan wins in the same moment', function () {
        [$claim, $hash] = fanSocialClaim();
        fanSocialTrip('facebook', fanSocialUser('77', 'fan@gmail.com'), ['claim_hash' => $hash]);
        $other = FanAccount::factory()->create(['email' => 'other@gmail.com']);
        fanSocialRival($other, 'facebook', '77');

        $this->getJson('/api/fan/auth/verify?token=' . fanSocialMailedToken() . '&claim=' . $claim)->assertOk()->assertJsonPath('linked', null);

        expect(FanIdentity::sole()->fan_account_id)->toBe($other->id);
    });

    it('opens two waiting mails one after the other', function () {
        [$claim, $hash] = fanSocialClaim();
        fanSocialTrip('facebook', fanSocialUser('77', 'fan@gmail.com'), ['claim_hash' => $hash]);
        $first = fanSocialMailedToken();
        fanSocialTrip('facebook', fanSocialUser('77', 'fan@gmail.com'), ['claim_hash' => $hash]);

        foreach ([$first, fanSocialMailedToken()] as $token) {
            $this->getJson("/api/fan/auth/verify?token={$token}&claim={$claim}")->assertOk()->assertJsonPath('linked', 'facebook');
        }
        expect(FanIdentity::count())->toBe(1);
    });

    it('signs in on a parked identity it cannot read', function () {
        [$claim, $hash] = fanSocialClaim();
        $token = FanMagicToken::issue(FanAccount::factory()->create(), ['identity' => 'facebook', 'claim_hash' => $hash]);

        $this->getJson("/api/fan/auth/verify?token={$token}&claim={$claim}")->assertOk()->assertJsonPath('linked', null);
    });

    it('keeps the return path and the language on the mailed link, and the language on the notice', function () {
        $res = fanSocialTrip('facebook', fanSocialUser('77', 'fan@gmail.com'), ['return_to' => '/pl/news/x', 'lang' => 'pl']);

        expect(fanSocialQuery($res))->toBe(['auth_notice' => 'confirm_email', 'lang' => 'pl']);
        expect(fanSocialMails()[0]->getOriginalMessage()->getTextBody())->toEndWith('&return=%2Fpl%2Fnews%2Fx&lang=pl');
    });

    it('redirects with failed when the mail cannot be sent', function () {
        Mail::shouldReceive('raw')->once()->andThrow(new RuntimeException('smtp to fan@gmail.com down'));
        Log::spy();

        expect(fanSocialQuery(fanSocialTrip('facebook', fanSocialUser('77', 'fan@gmail.com'), ['lang' => 'pl'])))
            ->toBe(['auth_error' => 'failed', 'lang' => 'pl']);
        Log::shouldHaveReceived('warning')->once()->withArgs(fn ($m) => ! str_contains($m, 'fan@gmail.com'));
    });

    it('fails, mailing nobody, when the address is a lookalike of another account\'s', function () {
        // The unique key refuses an address no row equals exactly, as MySQL's collation can.
        DB::statement('DROP TABLE fan_accounts');
        DB::statement('CREATE TABLE fan_accounts (id INTEGER PRIMARY KEY, email TEXT, name TEXT, display_name TEXT,
            password_hash TEXT, email_verified_at TEXT, comments_blocked_at TEXT, newsletter_subscribed INTEGER DEFAULT 0,
            remember_token TEXT, created_at TEXT, updated_at TEXT)');
        DB::statement("CREATE UNIQUE INDEX fan_accounts_fold ON fan_accounts (replace(email, '-', ''))");
        DB::table('fan_accounts')->insert(['email' => 'victim@gmail.com', 'name' => 'victim']);

        expect(fanSocialQuery(fanSocialTrip('facebook', fanSocialUser('77', 'vic-tim@gmail.com'))))->toBe(['auth_error' => 'failed']);
        expect(fanSocialQuery(fanSocialTrip('google', fanSocialUser('78', 'vic-tim@gmail.com'))))->toBe(['auth_error' => 'failed']);
        expect(fanSocialMails())->toBeEmpty()->and(FanIdentity::count())->toBe(0);
    });
});

describe('a callback that goes nowhere', function () {
    it('redirects with no_email when the provider gives none it can use', function (mixed $email) {
        expect(fanSocialQuery(fanSocialTrip('google', fanSocialUser('42', $email), ['lang' => 'pl'])))
            ->toBe(['auth_error' => 'no_email', 'lang' => 'pl']);
        expect(FanAccount::count())->toBe(0)->and(FanIdentity::count())->toBe(0);
    })->with([
        'none' => [null], 'empty' => [''], 'blank' => ['  '], 'an array' => [['a@gmail.com']],
        'not an address' => ['fan'], 'not ASCII' => ['victim@gmáil.com'], 'too long' => [str_repeat('a', 250) . '@gmail.com'],
    ]);

    it('redirects with failed when the provider gives no usable id', function (mixed $id) {
        expect(fanSocialQuery(fanSocialTrip('google', fanSocialUser($id, 'new@gmail.com'))))->toBe(['auth_error' => 'failed']);
        expect(FanAccount::count())->toBe(0);
    })->with(['none' => [null], 'empty' => [''], 'blank' => [' '], 'too long' => [str_repeat('1', 192)], 'an array' => [['1']], 'a boolean' => [true]]);

    it('redirects with cancelled when the user declined', function (string $provider) {
        fanSocialDriver($provider, null);
        $state = fanSocialStart($provider, ['lang' => 'pl']);

        expect(fanSocialQuery(fanSocialReturn($provider, $state, ['error' => 'access_denied', 'error_reason' => 'user_denied'])))
            ->toBe(['auth_error' => 'cancelled', 'lang' => 'pl']);
    })->with(['google', 'facebook']);

    it('redirects with failed on any other provider error, or no code', function (array $query) {
        fanSocialDriver('google', null);
        $state = fanSocialStart('google', ['lang' => 'pl']);

        expect(fanSocialQuery(fanSocialReturn('google', $state, $query)))->toBe(['auth_error' => 'failed', 'lang' => 'pl']);
    })->with([
        'server error' => [['error' => 'server_error', 'code' => 'abc']],
        'an array'     => [['error' => ['access_denied'], 'code' => 'abc']],
        'no code'      => [[]],
        'empty code'   => [['code' => '']],
        'array code'   => [['code' => ['abc']]],
    ]);

    it('refuses a state that does not match the cookie', function () {
        fanSocialDriver('google', null);
        $state = fanSocialStart('google', ['lang' => 'pl']);

        expect(fanSocialQuery(fanSocialReturn('google', $state, cookie: Str::random(40))))->toBe(['auth_error' => 'failed']);
        // And it is spent: the right cookie no longer helps.
        expect(fanSocialQuery(fanSocialReturn('google', $state)))->toBe(['auth_error' => 'failed']);
    });

    it('refuses a state another browser started, with no cookie of its own', function () {
        fanSocialDriver('google', null);
        $state = fanSocialStart('google');

        expect(fanSocialQuery($this->get("/api/fan/auth/google/callback?code=abc&state=$state")))->toBe(['auth_error' => 'failed']);
    });

    it('refuses a cookie and state that match each other but were never issued', function () {
        fanSocialDriver('google', null);

        expect(fanSocialQuery(fanSocialReturn('google', Str::random(40))))->toBe(['auth_error' => 'failed']);
    });

    it('refuses a state or a cookie that is an array or missing, never a 500', function () {
        Log::spy();
        fanSocialDriver('google', null);
        $state = fanSocialStart('google');

        expect(fanSocialQuery($this->withUnencryptedCookie(FAN_SOCIAL_COOKIE, $state)->get("/api/fan/auth/google/callback?code=abc&state[]=$state")))
            ->toBe(['auth_error' => 'failed']);
        expect(fanSocialQuery($this->withUnencryptedCookie(FAN_SOCIAL_COOKIE, $state)->get('/api/fan/auth/google/callback?code=abc')))
            ->toBe(['auth_error' => 'failed']);
        expect(fanSocialQuery($this->call('GET', "/api/fan/auth/google/callback?code=abc&state=$state", [], [FAN_SOCIAL_COOKIE => [$state]])))
            ->toBe(['auth_error' => 'failed']);
        // Refused as a mismatch, not caught as an error on the way.
        Log::shouldNotHaveReceived('warning');
    });

    it('refuses a state issued for the other provider', function () {
        fanSocialDriver('google', null);
        $state = fanSocialStart('google');
        fanSocialDriver('facebook', null);

        expect(fanSocialQuery(fanSocialReturn('facebook', $state)))->toBe(['auth_error' => 'failed']);
    });

    it('refuses a state used twice', function () {
        fanSocialDriver('google', fanSocialUser('42', 'new@gmail.com'));
        $state = fanSocialStart('google');

        expect(fanSocialQuery(fanSocialReturn('google', $state)))->toHaveKey('token');
        expect(fanSocialQuery(fanSocialReturn('google', $state)))->toBe(['auth_error' => 'failed']);
    });

    it('refuses a state that expired', function () {
        fanSocialDriver('google', null);
        $state = fanSocialStart('google');
        $this->travel(11)->minutes();

        expect(fanSocialQuery(fanSocialReturn('google', $state)))->toBe(['auth_error' => 'failed']);
    });

    it('redirects with failed when the provider was switched off meanwhile', function () {
        fanSocialDriver('google', null);
        $state = fanSocialStart('google');
        config(['services.google.client_secret' => '']);

        expect(fanSocialQuery(fanSocialReturn('google', $state))['auth_error'])->toBe('failed');
    });

    it('redirects with failed when the provider call throws, logging the class alone', function (Throwable $e) {
        Log::spy();

        expect(fanSocialQuery(fanSocialTrip('google', $e, ['lang' => 'pl'])))->toBe(['auth_error' => 'failed', 'lang' => 'pl']);
        Log::shouldHaveReceived('warning')->once()->withArgs(fn (...$args) => str_contains($args[0], 'google')
            && str_contains($args[0], $e::class)
            && ! str_contains(json_encode($args), 'secret-token'));
    })->with([
        'an exception' => [fn () => new RuntimeException('https://x?access_token=secret-token')],
        'an error'     => [fn () => new TypeError('secret-token')],
    ]);

    it('logs the status and error code a provider refused with, and nothing else of it', function (int $status, string $body, string $logged) {
        Log::spy();

        expect(fanSocialQuery(fanSocialTrip('google', fanSocialRefusal($status, $body))))->toBe(['auth_error' => 'failed']);
        Log::shouldHaveReceived('warning')->once()->withArgs(function (...$args) use ($logged) {
            expect($args[0])->toBe('Fan sign-in with google failed: ' . ClientException::class . " ($logged)")
                ->and($args[1] ?? [])->toBe([]);

            return true;
        });
    })->with([
        'a code among secrets' => [400, json_encode([
            'error' => 'invalid_grant', 'error_description' => 'fan@gmail.com secret-token', 'access_token' => 'secret-token',
        ]), 'HTTP 400, invalid_grant'],
        'an object, as Facebook answers' => [400, json_encode(['error' => ['message' => 'fan@gmail.com', 'code' => 190]]), 'HTTP 400'],
        'a code that is free text'       => [401, json_encode(['error' => 'fan@gmail.com is unknown']), 'HTTP 401'],
        'a code with a newline'          => [401, json_encode(['error' => "invalid_grant\n"]), 'HTTP 401'],
        'too long a code'                => [401, json_encode(['error' => str_repeat('a', 65)]), 'HTTP 401'],
        'not JSON'                       => [429, '<html>secret-token</html>', 'HTTP 429'],
        'JSON that is no object'         => [403, '"secret-token"', 'HTTP 403'],
        'nothing'                        => [404, '', 'HTTP 404'],
    ]);

    it('logs the class alone when the provider never answered', function () {
        Log::spy();
        $e = new ConnectException('secret-token', new GuzzleRequest('GET', 'https://x?access_token=secret-token'));

        expect(fanSocialQuery(fanSocialTrip('google', $e)))->toBe(['auth_error' => 'failed']);
        Log::shouldHaveReceived('warning')->once()->with('Fan sign-in with google failed: ' . ConnectException::class);
    });

    it('clears its own state cookie whatever the outcome', function () {
        fanSocialDriver('google', fanSocialUser('42', 'new@gmail.com'));
        $state = fanSocialStart('google');

        // A sign-in, the same state again, and a refusal from the provider.
        foreach ([[], [], ['error' => 'access_denied']] as $query) {
            $res    = fanSocialReturn('google', $state, $query + ['code' => 'abc']);
            $cookie = $res->getCookie(FAN_SOCIAL_COOKIE, false);
            expect($cookie->getPath())->toBe('/api/fan/auth')
                ->and($cookie->isCleared())->toBeTrue()
                ->and((string) $cookie->getValue())->not->toBe($state);
        }
    });

    it('leaves the cookie of a sign-in in another tab alone', function (string $query) {
        fanSocialDriver('google', fanSocialUser('42', 'new@gmail.com'));
        $first  = fanSocialStart('google');
        $second = fanSocialStart('google'); // the newer tab: the cookie is now its own

        $res = $this->withUnencryptedCookie(FAN_SOCIAL_COOKIE, $second)
            ->get('/api/fan/auth/google/callback?' . str_replace('FIRST', $first, $query));

        expect(fanSocialQuery($res))->toHaveKey('auth_error')
            ->and($res->getCookie(FAN_SOCIAL_COOKIE, false))->toBeNull();
        expect(fanSocialQuery(fanSocialReturn('google', $second)))->toHaveKey('token');
        // The first tab's state is spent all the same.
        expect(fanSocialQuery(fanSocialReturn('google', $first)))->toBe(['auth_error' => 'failed']);
    })->with([
        'the older tab comes back'   => ['code=abc&state=FIRST'],
        'the older tab was declined' => ['error=access_denied&state=FIRST'],
    ]);

    it('leaves the cookie alone when there is no state to match it', function (string $query) {
        fanSocialDriver('google', fanSocialUser('42', 'new@gmail.com'));
        $state = fanSocialStart('google');

        $res = $this->withUnencryptedCookie(FAN_SOCIAL_COOKIE, $state)->get("/api/fan/auth/google/callback?$query");

        expect(fanSocialQuery($res))->toBe(['auth_error' => 'failed'])
            ->and($res->getCookie(FAN_SOCIAL_COOKIE, false))->toBeNull();
        expect(fanSocialQuery(fanSocialReturn('google', $state)))->toHaveKey('token');
    })->with(['none' => ['code=abc'], 'an array' => ['code=abc&state[]=x']]);
});

describe('the drivers', function () {
    it('reads only the id and the email from Facebook, with a timeout', function () {
        $requests = [];
        $stack = HandlerStack::create(new MockHandler([
            new GuzzleResponse(200, [], json_encode(['access_token' => 'tok', 'expires_in' => 10])),
            new GuzzleResponse(200, [], json_encode(['id' => '77', 'email' => 'fan@gmail.com'])),
        ]));
        $stack->push(Middleware::history($requests));
        Socialite::driver('facebook')->setHttpClient(new Client(['handler' => $stack]));

        $state = fanSocialStart('facebook');
        Socialite::driver('facebook')->setRequest(Illuminate\Http\Request::create('/', 'GET', ['code' => 'abc']));
        expect(fanSocialQuery(fanSocialReturn('facebook', $state)))->toBe(['auth_notice' => 'confirm_email']);

        parse_str($requests[1]['request']->getUri()->getQuery(), $q);
        expect($requests[1]['request']->getUri()->getHost())->toBe('graph.facebook.com')
            ->and($q['fields'])->toBe('id,email');
    });

    it('times out after ten seconds', function (string $provider) {
        $driver = Socialite::driver($provider);

        expect((new ReflectionProperty($driver, 'guzzle'))->getValue($driver))->toMatchArray(['timeout' => 10, 'connect_timeout' => 10]);
    })->with(['google', 'facebook']);

    it('keeps the other settings these two services had', function () {
        $services = require config_path('services.php');

        expect($services['google'])->toHaveKeys(['api_key', 'cse_id', 'client_id', 'client_secret', 'redirect']);
        expect($services['facebook'])->toHaveKeys(['app_id', 'app_secret', 'page_id', 'page_access_token', 'instagram_user_id', 'client_id', 'client_secret', 'redirect']);
    });

    it('answers a callback over its limit with the usual redirect, keeping the state', function () {
        fanSocialDriver('google', fanSocialUser('42', 'new@gmail.com'));
        $state = fanSocialStart('google');
        $over  = null;
        foreach (range(1, 61) as $i) {
            $over = $this->get('/api/fan/auth/google/callback');
        }
        // Over the limit even with a good state: refused before anything is spent.
        $res = fanSocialReturn('google', $state);

        expect(fanSocialQuery($over))->toBe(['auth_error' => 'failed'])
            ->and(fanSocialQuery($res))->toBe(['auth_error' => 'failed'])
            ->and($res->getCookie(FAN_SOCIAL_COOKIE, false))->toBeNull();
        // The redirect's own count is untouched.
        $this->get('/api/fan/auth/google/redirect')->assertStatus(302);

        $this->travel(61)->seconds();
        expect(fanSocialQuery(fanSocialReturn('google', $state)))->toHaveKey('token');
    });

    it('is not spent by the redirect', function () {
        foreach (range(1, 20) as $i) {
            $state = fanSocialStart('google');
        }
        fanSocialDriver('google', fanSocialUser('42', 'new@gmail.com'));

        expect(fanSocialQuery(fanSocialReturn('google', $state)))->toHaveKey('token');
    });

    it('has a limit of its own, answered with the usual redirect', function () {
        foreach (range(1, 20) as $i) {
            fanSocialStart($i % 2 ? 'google' : 'facebook');
        }

        $over = $this->get('/api/fan/auth/google/redirect?lang=pl');
        expect(fanSocialQuery($over))->toBe(['auth_error' => 'failed', 'lang' => 'pl'])
            ->and($over->getCookie(FAN_SOCIAL_COOKIE, false))->toBeNull();

        $this->travel(61)->seconds();
        fanSocialStart('google');
    });

    it('is not spent by other throttled routes', function () {
        foreach (range(1, 25) as $i) {
            $this->postJson('/api/presale-codes/validate', ['code' => 'nope']);
        }

        fanSocialStart('google');
    });
});
