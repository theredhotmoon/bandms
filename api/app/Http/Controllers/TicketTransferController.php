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

        return response()->json([
            'message'  => 'Transfer initiated. The recipient will receive a claim link.',
            'dev_link' => url("/api/tickets/claim/{$claimToken}"),
        ]);
    }

    /**
     * POST /api/tickets/claim/{token}
     * Public route. Recipient claims a pending transfer.
     */
    public function claim(Request $request, string $token): JsonResponse
    {
        $transfer = TicketTransfer::where('claim_token', $token)->firstOrFail();

        if ($transfer->claimed_at !== null) {
            return response()->json(['message' => 'Already claimed.'], 409);
        }

        if ($transfer->expires_at < now()) {
            return response()->json(['message' => 'Transfer expired.'], 410);
        }

        $oldTicket = $transfer->fromTicket()->with('concertTicketType')->firstOrFail();

        $newTicket = DB::transaction(function () use ($transfer, $oldTicket) {
            // Void the original ticket
            $oldTicket->update([
                'status'         => 'transferred',
                'transferred_at' => now(),
            ]);

            // Mint new ticket for the recipient
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

            // Stamp the transfer as claimed
            $transfer->update(['claimed_at' => now()]);

            return $newTicket;
        });

        return response()->json([
            'message'     => 'Ticket claimed successfully.',
            'ticket_uuid' => $newTicket->uuid,
        ]);
    }
}
