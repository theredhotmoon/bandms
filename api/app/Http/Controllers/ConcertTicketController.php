<?php

namespace App\Http\Controllers;

use App\Models\Ticket;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ConcertTicketController extends Controller
{
    public function doorCheck(Request $request): JsonResponse
    {
        $request->validate(['code' => 'required|string']);

        $ticket = Ticket::where('uuid', $request->code)
            ->with(['concertTicketType.concert.venue', 'orderItem.order'])
            ->first();

        if (! $ticket) {
            return response()->json(['valid' => false, 'reason' => 'Unknown ticket code.'], 200);
        }

        if ($ticket->status === 'voided' || $ticket->status === 'transferred') {
            return response()->json(['valid' => false, 'reason' => 'Ticket is no longer valid (' . $ticket->status . ').'], 200);
        }

        // Check the underlying order is paid
        $order = $ticket->orderItem?->order;
        if ($order && $order->status->value !== 'paid') {
            return response()->json(['valid' => false, 'reason' => 'Order not paid.'], 200);
        }

        $concert = $ticket->concertTicketType?->concert;

        return response()->json([
            'valid'        => true,
            'scanned'      => $ticket->status === 'scanned',
            'scanned_at'   => $ticket->scanned_at?->toIso8601String(),
            'ticket_type'  => $ticket->concertTicketType?->name,
            'concert'      => $concert?->venue?->name,
            'concert_date' => $concert?->date?->toDateString(),
            'customer'     => $order?->name ?? $ticket->holder_name,
            'order_uuid'   => $order?->uuid,
            'holder_email' => $ticket->holder_email,
        ]);
    }

    public function doorScan(Request $request): JsonResponse
    {
        $request->validate(['code' => 'required|string']);

        $ticket = Ticket::where('uuid', $request->code)
            ->with(['concertTicketType.concert.venue', 'orderItem.order'])
            ->first();

        if (! $ticket) {
            return response()->json(['valid' => false, 'reason' => 'Unknown ticket code.'], 200);
        }

        if ($ticket->status === 'voided' || $ticket->status === 'transferred') {
            return response()->json(['valid' => false, 'reason' => 'Ticket is no longer valid (' . $ticket->status . ').'], 200);
        }

        // Check the underlying order is paid
        $order = $ticket->orderItem?->order;
        if ($order && $order->status->value !== 'paid') {
            return response()->json(['valid' => false, 'reason' => 'Order not paid.'], 200);
        }

        if ($ticket->status === 'scanned') {
            $concert = $ticket->concertTicketType?->concert;

            return response()->json([
                'valid'        => true,
                'scanned'      => true,
                'already_used' => true,
                'scanned_at'   => $ticket->scanned_at?->toIso8601String(),
                'ticket_type'  => $ticket->concertTicketType?->name,
                'concert'      => $concert?->venue?->name,
                'concert_date' => $concert?->date?->toDateString(),
                'customer'     => $order?->name ?? $ticket->holder_name,
                'order_uuid'   => $order?->uuid,
                'holder_email' => $ticket->holder_email,
            ]);
        }

        $ticket->update(['status' => 'scanned', 'scanned_at' => now()]);

        $concert = $ticket->concertTicketType?->concert;

        return response()->json([
            'valid'        => true,
            'scanned'      => true,
            'already_used' => false,
            'scanned_at'   => $ticket->scanned_at?->toIso8601String(),
            'ticket_type'  => $ticket->concertTicketType?->name,
            'concert'      => $concert?->venue?->name,
            'concert_date' => $concert?->date?->toDateString(),
            'customer'     => $order?->name ?? $ticket->holder_name,
            'order_uuid'   => $order?->uuid,
            'holder_email' => $ticket->holder_email,
        ]);
    }
}
