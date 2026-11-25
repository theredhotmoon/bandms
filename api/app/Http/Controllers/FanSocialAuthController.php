<?php

namespace App\Http\Controllers;

use App\Models\FanAccount;
use App\Models\FanIdentity;
use App\Support\FanEmail;
use App\Support\FanMagicToken;
use App\Support\FanProviders;
use App\Support\FanSignInLink;
use App\Support\Locales;
use App\Support\ReturnPath;
use GuzzleHttp\Exception\RequestException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\AbstractProvider;
use Laravel\Socialite\Two\User;
use Symfony\Component\HttpFoundation\Cookie;

/**
 * Sign-in with Google or Facebook. No session is opened here: a fan who may be
 * signed in leaves with a five-minute magic token, which /account exchanges.
 */
class FanSocialAuthController extends Controller
{
    private const COOKIE = 'fan_oauth_state';
    private const COOKIE_PATH = '/api/fan/auth';
    private const STATE_MINUTES = 10;
    private const TOKEN_MINUTES = 5;

    /** Links mailed to one fan for sign-ins nobody vouched for. */
    private const MAX_MAILS = 5;
    private const MAIL_DECAY_SECONDS = 900;

    private const GOOGLE_MAIL = ['gmail.com', 'googlemail.com'];

    // GET /api/fan/auth/{provider}/redirect?return_to=&lang=&claim_hash= -> always a 302
    public function redirect(Request $request, string $provider): RedirectResponse
    {
        try {
            // Off: the button that was pressed is out of date.
            if (FanProviders::isEnabled($provider)) {
                return $this->start($request, $provider);
            }
        } catch (\Throwable $e) {
            $this->logFailure($provider, $e);
        }

        // A person is looking at this, so a page: never a 404 or a 500 in JSON.
        return redirect()->away(FanSignInLink::errorUrl('failed', $request->query('lang')));
    }

    private function start(Request $request, string $provider): RedirectResponse
    {
        $state = Str::random(40);

        cache()->put(self::stateKey($state), [
            'provider'   => $provider,
            'return_to'  => ReturnPath::clean($request->query('return_to')),
            'lang'       => Locales::supportedOrNull($request->query('lang')),
            'claim_hash' => self::cleanClaimHash($request->query('claim_hash')),
        ], now()->addMinutes(self::STATE_MINUTES));

        return redirect()
            ->away($this->driver($provider)->with(['state' => $state])->redirect()->getTargetUrl())
            ->withCookie($this->cookie($state, now()->addMinutes(self::STATE_MINUTES)->getTimestamp()));
    }

    // GET /api/fan/auth/{provider}/callback -> always a 302 to the account page
    public function callback(Request $request, string $provider): RedirectResponse
    {
        $state = null;

        try {
            $state = $this->takeState($request, $provider);
            $url   = $this->outcome($request, $provider, $state);
        } catch (\Throwable $e) {
            $this->logFailure($provider, $e);
            $url = $this->error('failed', $state);
        }

        $response = redirect()->away($url);

        // Only this sign-in's cookie: the browser has one, and another tab may since
        // have started a sign-in of its own.
        return $this->startedHere($request, self::returnedState($request))
            ? $response->withCookie($this->cookie(null, 1))
            : $response;
    }

    private function outcome(Request $request, string $provider, ?array $state): string
    {
        // Declining changes nothing, so it is worded as such even once the state has expired.
        if ($request->query('error') === 'access_denied') {
            return $this->error('cancelled', $state);
        }

        // Stateless Socialite checks no state of its own: without this, anyone
        // could sign a visitor in as themselves. Before user(), always.
        if ($state === null || ! FanProviders::isEnabled($provider)) {
            return $this->error('failed', $state);
        }

        $code = $request->query('code');
        if ($request->query('error') !== null || ! is_string($code) || $code === '') {
            return $this->error('failed', $state);
        }

        $user = $this->driver($provider)->user();

        $id = self::cleanId($user->getId());
        if ($id === null) {
            return $this->error('failed', $state);
        }

        // Linked already: that fan, whatever address the provider reports today.
        if ($identity = FanIdentity::findLinked($provider, $id)) {
            return $this->signIn($identity->fan, $provider, $state);
        }

        $email = self::cleanEmail($user->getEmail());
        if ($email === null) {
            return $this->error('no_email', $state);
        }

        $fan = FanAccount::findOrCreateByEmail($email);
        if ($fan === null) {
            return $this->error('failed', $state);
        }

        return $this->vouchedFor($provider, $user, $email)
            ? $this->linkAndSignIn($fan, $provider, $id, $state)
            : $this->mailLink($fan, $provider, $id, $state);
    }

    private function linkAndSignIn(FanAccount $fan, string $provider, string $id, array $state): string
    {
        if ($fan->email_verified_at === null) {
            $fan->forceFill(['email_verified_at' => now()])->save();
        }

        // Another callback may have linked it a moment ago, and then it is that fan's.
        $identity = FanIdentity::linkTo($fan, $provider, $id);

        return $identity === null
            ? $this->error('failed', $state)
            : $this->signIn($identity->fan, $provider, $state);
    }

    private function signIn(FanAccount $fan, string $provider, array $state): string
    {
        $token = FanMagicToken::issue($fan, ['method' => $provider], self::TOKEN_MINUTES);

        return FanSignInLink::url($token, $state['return_to'], $state['lang']);
    }

    /**
     * The address is only the provider's word, so it is proven by mail first. The
     * identity waits on that link, and is linked only for the browser that holds
     * the claim (see FanAccountController::verifyMagicLink).
     */
    private function mailLink(FanAccount $fan, string $provider, string $id, array $state): string
    {
        $sent = FanSignInLink::accountUrl(['auth_notice' => 'confirm_email', 'lang' => $state['lang']]);

        // Per fan, whatever provider account asks. Answered as usual: it is the mailbox
        // that is being spared, and the caller learns nothing about it.
        if (RateLimiter::hit("fan-social-mail:{$fan->id}", self::MAIL_DECAY_SECONDS) > self::MAX_MAILS) {
            return $sent;
        }

        $extra = $state['claim_hash'] === null ? [] : [
            'identity'   => ['provider' => $provider, 'provider_user_id' => $id],
            'claim_hash' => $state['claim_hash'],
        ];

        $token = FanMagicToken::issue($fan, $extra);

        try {
            FanSignInLink::send($fan, $token, $state['return_to'], $state['lang']);
        } catch (\Throwable) {
            return $this->error('failed', $state); // logged by send()
        }

        return $sent;
    }

    /**
     * The class and, when the provider answered, its status and OAuth error code.
     * Nothing else of the answer, and no message: either can hold a token, a URL or
     * an address.
     */
    private function logFailure(string $provider, \Throwable $e): void
    {
        $response = $e instanceof RequestException ? $e->getResponse() : null;
        $detail   = '';

        if ($response !== null) {
            $code   = rescue(fn () => json_decode((string) $response->getBody(), true)['error'] ?? null, report: false);
            $known  = is_string($code) && preg_match('/^[a-z_]{1,64}$/D', $code) === 1;
            $detail = " (HTTP {$response->getStatusCode()}" . ($known ? ", {$code}" : '') . ')';
        }

        Log::warning("Fan sign-in with {$provider} failed: " . $e::class . $detail);
    }

    private function error(string $code, ?array $state): string
    {
        return FanSignInLink::errorUrl($code, $state['lang'] ?? null);
    }

    /** Whether the provider vouches for this (normalised) address, and the band lets it. */
    private function vouchedFor(string $provider, User $user, string $email): bool
    {
        return FanProviders::trustsEmail($provider)
            && ($provider !== 'google' || self::googleVouches($user->getRaw(), $email));
    }

    /**
     * `email_verified` alone says the address was proven once, perhaps by someone who
     * has since lost it. Google speaks for an address today only where it runs the
     * mailbox: its own mail, or the domain it hosts for this account (`hd`).
     */
    private static function googleVouches(array $raw, string $email): bool
    {
        if (! in_array($raw['email_verified'] ?? null, [true, 'true'], true)) {
            return false;
        }

        $domain = substr($email, strrpos($email, '@') + 1);
        $hosted = $raw['hd'] ?? null;

        return in_array($domain, self::GOOGLE_MAIL, true)
            || (is_string($hosted) && $domain === FanEmail::normalise($hosted));
    }

    /**
     * setScopes(), not scopes(): that one merges, and would keep Google's `profile`.
     * reRequest(): Facebook does not ask again for an email once declined, and that
     * fan would get `no_email` for good.
     */
    private function driver(string $provider): AbstractProvider
    {
        $driver = Socialite::driver($provider)->stateless()
            ->setScopes(config("fan_auth.providers.{$provider}.scopes"));

        return $provider === 'facebook' ? $driver->fields(['id', 'email'])->reRequest() : $driver;
    }

    /** What the redirect remembered, if this browser started it. Single use. */
    private function takeState(Request $request, string $provider): ?array
    {
        $state = self::returnedState($request);
        if ($state === null) {
            return null;
        }

        // Spent whichever browser brings it.
        $stored = cache()->pull(self::stateKey($state));

        if (! is_array($stored) || ! $this->startedHere($request, $state)) {
            return null;
        }

        return $stored['provider'] === $provider ? $stored : null;
    }

    private static function returnedState(Request $request): ?string
    {
        $state = $request->query('state');

        return is_string($state) && preg_match('/^[A-Za-z0-9]{40}$/D', $state) === 1 ? $state : null;
    }

    /** Whether the state cookie this browser holds is the one for this state. */
    private function startedHere(Request $request, ?string $state): bool
    {
        // Not cookies->get(): that throws on an array.
        $cookie = $request->cookies->all()[self::COOKIE] ?? null;

        return $state !== null && is_string($cookie) && hash_equals($cookie, $state);
    }

    /** Secure by the site's public URL, because TLS ends at Caddy. A null value clears it. */
    private function cookie(?string $value, int $expires): Cookie
    {
        $secure = str_starts_with(strtolower((string) config('newsletter.frontend_url')), 'https://');

        return new Cookie(self::COOKIE, $value, $expires, self::COOKIE_PATH, null, $secure, true, false, Cookie::SAMESITE_LAX);
    }

    private static function stateKey(string $state): string
    {
        return "fan_oauth:{$state}";
    }

    private static function cleanClaimHash(mixed $hash): ?string
    {
        return is_string($hash) && preg_match('/^[a-f0-9]{64}$/D', $hash) === 1 ? $hash : null;
    }

    private static function cleanId(mixed $id): ?string
    {
        $id = is_int($id) ? (string) $id : $id;

        return is_string($id) && trim($id) !== '' && mb_strlen($id) <= 191 ? $id : null;
    }

    private static function cleanEmail(mixed $email): ?string
    {
        if (! is_string($email)) {
            return null;
        }

        $email = FanEmail::normalise($email);

        return Validator::make(['email' => $email], ['email' => FanEmail::rules()])->passes() ? $email : null;
    }
}
