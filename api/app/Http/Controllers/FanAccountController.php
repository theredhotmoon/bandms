<?php

namespace App\Http\Controllers;

use App\Models\FanAccount;
use App\Models\Order;
use App\Models\Ticket;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class FanAccountController extends Controller
{
    // POST /api/fan/auth/magic-link
    // Body: {email: string, name?: string}
    // Creates fan_account if email not found, generates signed token, returns {message, dev_link}
    public function requestMagicLink(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => 'required|email|max:255',
            'name'  => 'nullable|string|max:255',
        ]);

        $fan = FanAccount::firstOrCreate(
            ['email' => $data['email']],
            ['name' => $data['name'] ?? explode('@', $data['email'])[0]]
        );

        $token = Str::random(64);
        cache()->put("fan_magic:{$token}", $fan->id, now()->addHours(24));

        $verifyUrl = url("/api/fan/auth/verify?token={$token}");

        return response()->json([
            'message'  => 'Magic link sent to your email.',
            'dev_link' => $verifyUrl,
        ]);
    }

    // GET /api/fan/auth/verify?token={token}
    // Verifies the magic token, returns {token, fan}
    public function verifyMagicLink(Request $request): JsonResponse
    {
        $token = $request->query('token', '');
        $fanId = cache()->pull("fan_magic:{$token}");

        abort_unless($fanId, 401, 'Invalid or expired token.');

        $fan          = FanAccount::findOrFail($fanId);
        $sessionToken = Str::random(64);
        cache()->put("fan_session:{$sessionToken}", $fan->id, now()->addDays(30));

        return response()->json([
            'token' => $sessionToken,
            'fan'   => [
                'id'                    => $fan->id,
                'email'                 => $fan->email,
                'name'                  => $fan->name,
                'newsletter_subscribed' => $fan->newsletter_subscribed,
            ],
        ]);
    }

    // GET /api/fan/me  (requires fan.auth middleware)
    public function me(Request $request): JsonResponse
    {
        $fan = $request->attributes->get('fan');

        return response()->json([
            'id'                    => $fan->id,
            'email'                 => $fan->email,
            'name'                  => $fan->name,
            'newsletter_subscribed' => $fan->newsletter_subscribed,
        ]);
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
            ->get();

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

    // GET /api/fan/orders  (requires fan.auth middleware)
    public function orders(Request $request): JsonResponse
    {
        $fan = $request->attributes->get('fan');

        $orders = Order::where('email', $fan->email)
            ->with(['items.tickets'])
            ->orderByDesc('created_at')
            ->get();

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
