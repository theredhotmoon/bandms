<?php

namespace App\Http\Controllers;

use App\Models\Ticket;
use App\Models\TicketTransfer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class TicketTransferController extends Controller
{
    /**
     * POST /api/fan/tickets/{uuid}/transfer
     * Fan-auth protected. Initiates a transfer of an active ticket to another email.
     */
    public function initiate(Request $request, string $uuid): JsonResponse
    {
        $data = $request->validate([
            'to_email' => 'required|email|max:255',
        ]);

        $ticket = Ticket::where('uuid', $uuid)->firstOrFail();
        $fan    = $request->attributes->get('fan');

        // Ticket must be active
        if ($ticket->status !== 'active') {
            return response()->json(['message' => 'Only active tickets can be transferred.'], 422);
        }

        // Fan must own the ticket
        $isOwner = ($fan->email === $ticket->holder_email)
            || ($fan->id === $ticket->fan_account_id);

        if (! $isOwner) {
            return response()->json(['message' => 'You do not own this ticket.'], 403);
        }

        // Cannot transfer to yourself
        if ($data['to_email'] === $ticket->holder_email) {
            return response()->json(['message' => 'You cannot transfer a ticket to yourself.'], 422);
        }

        // No pending transfer already in flight
        $hasPending = TicketTransfer::where('from_ticket_id', $ticket->id)
            ->whereNull('claimed_at')
            ->where('expires_at', '>', now())
            ->exists();

        if ($hasPending) {
            return response()->json(['message' => 'A pending transfer already exists for this ticket.'], 422);
        }

        $claimToken = Str::random(64);

        TicketTransfer::create([
            'from_ticket_id' => $ticket->id,
            'to_email'       => $data['to_email'],
            'claim_token'    => $claimToken,
            'expires_at'     => now()->addHours(48),
        ]);

        $response = ['message' => 'Transfer initiated. The recipient will receive a claim link.'];

        if (config('app.debug')) {
            $response['dev_link'] = url("/api/tickets/claim/{$claimToken}");
        }

        return response()->json($response);
    }

    /**
     * POST /api/tickets/claim/{token}
     * Public route. Recipient claims a pending transfer.
     */
    public function claim(Request $request, string $token): JsonResponse
    {
        // Optimistic pre-check to return fast on obvious 404
        abort_unless(TicketTransfer::where('claim_token', $token)->exists(), 404);

        try {
            $newTicket = DB::transaction(function () use ($token) {
                // Re-fetch with row lock to prevent concurrent double-claim
                $transfer = TicketTransfer::where('claim_token', $token)
                    ->lockForUpdate()
                    ->firstOrFail();

                if ($transfer->claimed_at !== null) {
                    abort(409, 'Already claimed.');
                }

                if ($transfer->expires_at < now()) {
                    abort(410, 'Transfer expired.');
                }

                $oldTicket = $transfer->fromTicket()->lockForUpdate()->firstOrFail();

                $oldTicket->update([
                    'status'         => 'transferred',
                    'transferred_at' => now(),
                ]);

                $newTicket = Ticket::create([
                    'uuid'                   => (string) Str::uuid(),
                    'order_item_id'          => $oldTicket->order_item_id,
                    'concert_ticket_type_id' => $oldTicket->concert_ticket_type_id,
                    'status'                 => 'active',
                    'holder_email'           => $transfer->to_email,
                    'holder_name'            => explode('@', $transfer->to_email)[0],
                    'transferred_from_id'    => $oldTicket->id,
                    'transferred_at'         => now(),
                ]);

                $transfer->update(['claimed_at' => now()]);

                return $newTicket;
            });
        } catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) {
            return response()->json(['message' => $e->getMessage()], $e->getStatusCode());
        }

        return response()->json([
            'message'     => 'Ticket claimed successfully.',
            'ticket_uuid' => $newTicket->uuid,
        ]);
    }
}
