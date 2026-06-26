<?php

namespace App\Services;

use App\Jobs\GenerateAppleWalletPass;
use App\Models\Ticket;
use Illuminate\Support\Facades\Log;

class TicketWalletService
{
    /**
     * Push an Apple Wallet update notification for the given ticket.
     *
     * Dispatches GenerateAppleWalletPass to the queue. Real APNS push delivery
     * requires Apple-issued certificates (APPLE_PASS_CERT, APPLE_PASS_KEY,
     * APPLE_WWDR_CERT) which are not yet configured; the job handle() is a stub
     * until Phase 2 implementation.
     */
    public function pushAppleWalletUpdate(Ticket $ticket): void
    {
        GenerateAppleWalletPass::dispatch($ticket);
    }

    /**
     * Push a Google Wallet update notification for the given ticket.
     *
     * This is a stub. Real Google Wallet update delivery requires a service
     * account key (GOOGLE_WALLET_SA_KEY) and a configured issuer ID
     * (GOOGLE_WALLET_ISSUER_ID) which are not yet set up.
     * Implementation will be added in a future task.
     */
    public function pushGoogleWalletUpdate(Ticket $ticket): void
    {
        Log::warning('Google Wallet push not configured — skipping Google Wallet update for ticket ' . $ticket->uuid);
    }
}
