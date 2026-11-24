<?php

namespace App\Http\Controllers;

use App\Models\FanAccount;
use App\Support\FanEmail;
use App\Support\FanMagicToken;
use App\Support\FanPassword;
use App\Support\FanPayload;
use App\Support\FanSession;
use App\Support\FanSignInLink;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;

class FanAuthController extends Controller
{
    private const MAX_FAILURES = 10;
    private const DECAY_SECONDS = 900;

    /**
     * Two fans signing in at once can deadlock: FanSession::open()'s delete of expired
     * rows holds a gap lock until its insert. Laravel runs the victim again, so a
     * transaction here may run twice: no mail and no counted failure inside one.
     */
    private const TRANSACTION_ATTEMPTS = 3;

    /**
     * A valid bcrypt hash of nothing anyone knows, checked when there is no
     * account or no password so a miss costs the same time as a wrong guess.
     */
    private const DUMMY_HASH = '$2y$12$RpwUjkXrh4ZbWqxMzd8aOuN9q0G5wmQv0c5H9c9H8u3JfY7S1m1bK';

    // POST /api/fan/auth/login
    // Body: {email, password} -> {token, fan}
    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email'    => 'required|string|max:255',
            'password' => 'required|string|max:200',
        ]);

        $email = FanEmail::normalise($data['email']);
        $key   = 'fan-login:' . sha1($email);

        if (RateLimiter::tooManyAttempts($key, self::MAX_FAILURES)) {
            return response()->json([
                'message' => __('api.fan.login_limit'),
                'code'    => 'login_limit',
            ], 429);
        }

        // An address no account can have is an ordinary miss, dummy hash included:
        // a 422 of its own would be a second answer to tell apart.
        $fan  = FanEmail::isAllowed($email) ? FanAccount::findByEmail($email) : null;
        $hash = $fan?->password_hash ?? self::DUMMY_HASH;
        $ok   = Hash::check($data['password'], $hash) && $fan?->password_hash !== null;

        $token = $ok ? $this->openPasswordSession($fan) : null;

        if ($token === null) {
            RateLimiter::hit($key, self::DECAY_SECONDS);

            return response()->json([
                'message' => __('api.fan.login_failed'),
                'code'    => 'login_failed',
            ], 422);
        }

        RateLimiter::clear($key);

        return response()->json([
            'token' => $token,
            'fan'   => FanPayload::for($fan, FanSession::rowFor($token)),
        ]);
    }

    // POST /api/fan/auth/register
    // Body: {email, password, claim_hash?, return_to?} -> always the same "check your email".
    // Nothing is signed in and nothing is set here: the password is hashed and parked
    // with the link token, and applied only when that link is opened by the browser
    // that holds the claim (see FanAccountController::verifyMagicLink).
    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email'      => FanEmail::rules(),
            'password'   => FanPassword::rules(),
            'claim_hash' => ['nullable', 'regex:/^[a-f0-9]{64}$/'],
            'return_to'  => 'nullable',
        ]);

        $response = ['message' => __('api.fan.register_sent')];

        $fan = FanAccount::findOrCreateByEmail($data['email']);

        // Hashed whether or not the account has a password, so the time taken
        // does not tell a known address from an unknown one.
        $hash = Hash::make($data['password']);

        if ($fan === null) {
            return response()->json($response);
        }

        $extra = [];
        if ($fan->password_hash === null && ! empty($data['claim_hash'])) {
            $extra = ['password_hash' => $hash, 'claim_hash' => $data['claim_hash']];
        }

        $token = FanMagicToken::issue($fan, $extra);

        try {
            $url = FanSignInLink::send($fan, $token, $data['return_to'] ?? null);
        } catch (\Throwable) {
            return response()->json(['message' => __('api.fan.register_mail_failed')], 503);
        }

        if (config('app.debug')) {
            $response['dev_link'] = $url;
        }

        return response()->json($response);
    }

    // PUT /api/fan/me/password  (fan.auth)
    // Body: {password, current_password?} -> FanPayload
    public function setPassword(Request $request): JsonResponse
    {
        /** @var FanAccount $fan */
        $fan     = $request->attributes->get('fan');
        $session = $request->attributes->get('fan_session');

        $data = $request->validate([
            'password'         => FanPassword::rules(),
            'current_password' => 'nullable|string|max:200',
        ]);

        $hash    = Hash::make($data['password']);
        $current = (string) ($data['current_password'] ?? '');
        // Per fan, not per address: a stolen session must not be a way to guess
        // the password from many addresses.
        $key     = "fan-current-password:{$fan->id}";

        // Everything that decides is read again under the lock: a password set, or
        // this session signed out, since FanAuth let the request in must count.
        [$outcome, $fan, $session] = DB::transaction(function () use ($fan, $session, $current, $hash, $key) {
            $fan = FanAccount::whereKey($fan->id)->lockForUpdate()->first();
            $session = $fan ? $session->fresh() : null;
            abort_unless($session, 401, __('api.fan.session_expired'));

            if (FanPayload::needsCurrent($fan, $session)) {
                if ($current === '') {
                    return ['missing', $fan, $session];
                }
                if (RateLimiter::tooManyAttempts($key, self::MAX_FAILURES)) {
                    return ['limited', $fan, $session];
                }
                if (! Hash::check($current, $fan->password_hash)) {
                    return ['wrong', $fan, $session];
                }
            }

            $outcome = $fan->password_hash === null ? 'set' : 'changed';
            $fan->forceFill(['password_hash' => $hash])->save();
            FanSession::revokeOthers($fan, $session);

            return [$outcome, $fan, $session];
        }, self::TRANSACTION_ATTEMPTS);

        if ($outcome === 'limited') {
            return response()->json([
                'message' => __('api.fan.password_limit'),
                'code'    => 'login_limit',
            ], 429);
        }

        if ($outcome === 'wrong') {
            RateLimiter::hit($key, self::DECAY_SECONDS);
        }

        if ($outcome === 'wrong' || $outcome === 'missing') {
            throw ValidationException::withMessages([
                'current_password' => __('api.fan.current_password_wrong'),
            ]);
        }

        RateLimiter::clear($key);
        FanPassword::notify($fan, $outcome === 'set');

        return response()->json(FanPayload::for($fan, $session));
    }

    /**
     * A session for a fan whose password was just verified — or null when it was
     * changed in the meantime: a change signs out every other session, and one
     * opened a moment later on the old password would have slipped past it.
     */
    private function openPasswordSession(FanAccount $fan): ?string
    {
        return DB::transaction(function () use ($fan) {
            $now = FanAccount::whereKey($fan->id)->lockForUpdate()->value('password_hash');

            return $now === $fan->password_hash ? FanSession::open($fan, 'password') : null;
        }, self::TRANSACTION_ATTEMPTS);
    }
}
