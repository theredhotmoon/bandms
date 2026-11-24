<?php

namespace App\Http\Controllers;

use App\Models\FanAccount;
use App\Models\Order;
use App\Models\Ticket;
use App\Support\DisplayName;
use App\Support\FanEmail;
use App\Support\FanMagicToken;
use App\Support\FanPassword;
use App\Support\FanPayload;
use App\Support\FanSession;
use App\Support\FanSignInLink;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FanAccountController extends Controller
{
    // GET /api/fan-accounts  (admin)
    public function adminList(Request $request): JsonResponse
    {
        $fans = \App\Models\FanAccount::withCount('tickets')
            ->orderByDesc('created_at')
            ->paginate(50);
        return response()->json($fans);
    }

    // POST /api/fan/auth/magic-link
    // Body: {email: string, name?: string}
    // Creates fan_account if email not found, generates signed token, returns {message, dev_link}
    public function requestMagicLink(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => FanEmail::rules(),
            'name'  => 'nullable|string|max:255',
            // Where to send the fan after sign-in (a news post they wanted to
            // comment on). Not validated as a rule: a bad value is dropped,
            // never a 422 — the fan still gets a working link to /account.
            'return_to' => 'nullable',
        ]);

        $response = ['message' => 'Magic link sent to your email.'];

        $fan = FanAccount::findOrCreateByEmail($data['email'], $data['name'] ?? null);
        if ($fan === null) {
            return response()->json($response);
        }

        $token = FanMagicToken::issue($fan);

        try {
            $verifyUrl = FanSignInLink::send($fan, $token, $data['return_to'] ?? null);
        } catch (\Throwable) {
            return response()->json(['message' => 'We could not send the email. Please try again.'], 503);
        }

        if (config('app.debug')) {
            $response['dev_link'] = $verifyUrl;
        }

        return response()->json($response);
    }

    // GET /api/fan/auth/verify?token={token}
    // Verifies the magic token, returns {token, fan}
    public function verifyMagicLink(Request $request): JsonResponse
    {
        $token = $request->query('token', '');
        $magic = is_string($token) && $token !== '' ? FanMagicToken::pull($token) : null;

        abort_unless($magic, 401, 'Invalid or expired token.');

        $fan = FanAccount::findOrFail($magic['fan_id']);

        if ($fan->email_verified_at === null) {
            $fan->forceFill(['email_verified_at' => now()])->save();
        }

        // A password parked by register is applied only for the browser that
        // typed it (it holds the claim) and only onto an account with none.
        // The conditional update is the check, so two openings cannot both win.
        $passwordSet = $magic['password_hash'] !== null
            && FanMagicToken::claimMatches($magic['claim_hash'], $request->query('claim'))
            && FanAccount::whereKey($fan->id)->whereNull('password_hash')->update(['password_hash' => $magic['password_hash']]) === 1;

        if ($passwordSet) {
            FanPassword::notify($fan, true);
        }

        $fan->refresh();
        $sessionToken = FanSession::open($fan, $magic['method']);

        return response()->json([
            'token'        => $sessionToken,
            'fan'          => FanPayload::for($fan, FanSession::rowFor($sessionToken)),
            'password_set' => $passwordSet,
            'linked'       => null,
        ]);
    }

    // GET /api/fan/me  (requires fan.auth middleware)
    public function me(Request $request): JsonResponse
    {
        return response()->json(FanPayload::for($request->attributes->get('fan'), $request->attributes->get('fan_session')));
    }

    // PUT /api/fan/me  (requires fan.auth middleware)
    // Body: {display_name: string} — the name shown on the fan's comments.
    public function updateMe(Request $request): JsonResponse
    {
        $fan = $request->attributes->get('fan');

        $request->merge(['display_name' => DisplayName::clean($request->input('display_name'))]);
        $data = $request->validate(['display_name' => DisplayName::rules()]);
        DisplayName::assertAllowed($data['display_name']);

        $fan->update(['display_name' => $data['display_name']]);

        return response()->json(FanPayload::for($fan, $request->attributes->get('fan_session')));
    }

    // GET /api/fan/tickets  (requires fan.auth middleware)
    public function tickets(Request $request): JsonResponse
    {
        $fan = $request->attributes->get('fan');

        $tickets = Ticket::where(fn($q) => $q
            ->where('fan_account_id', $fan->id)
            ->orWhere('holder_email', $fan->email)
        )
            ->with(['concertTicketType.concert.venue'])
            ->orderByDesc('created_at')
            ->get()
            // The query compares addresses as MySQL does, which is not exactly (see FanEmail).
            ->filter(fn (Ticket $t) => $t->fan_account_id === $fan->id || FanEmail::same($t->holder_email, $fan->email))
            ->values();

        return response()->json($tickets->map(fn($t) => [
            'uuid'         => $t->uuid,
            'status'       => $t->status,
            'holder_name'  => $t->holder_name,
            'holder_email' => $t->holder_email,
            'ticket_type'  => $t->concertTicketType?->name,
            'concert_date' => $t->concertTicketType?->concert?->date?->format('Y-m-d'),
            'venue'        => $t->concertTicketType?->concert?->venue?->name,
        ]));
    }

    // POST /api/fan/auth/logout — invalidates the session token
    public function logout(Request $request): JsonResponse
    {
        FanSession::close($request);

        return response()->json(['message' => 'Logged out.']);
    }

    // GET /api/fan/orders  (requires fan.auth middleware)
    public function orders(Request $request): JsonResponse
    {
        $fan = $request->attributes->get('fan');

        $orders = Order::where('email', $fan->email)
            ->with(['items.tickets'])
            ->orderByDesc('created_at')
            ->get()
            ->filter(fn (Order $o) => FanEmail::same($o->email, $fan->email))
            ->values();

        return response()->json($orders->map(fn($o) => [
            'uuid'       => $o->uuid,
            'status'     => $o->status->value,
            'total'      => $o->total,
            'currency'   => $o->currency,
            'created_at' => $o->created_at->toIso8601String(),
            'items'      => $o->items->map(fn($item) => [
                'name'         => $item->name,
                'quantity'     => $item->quantity,
                'price'        => $item->price,
                'ticket_uuids' => $item->concert_ticket_type_id
                    ? $item->tickets->pluck('uuid')->all()
                    : null,
            ]),
        ]));
    }
}
