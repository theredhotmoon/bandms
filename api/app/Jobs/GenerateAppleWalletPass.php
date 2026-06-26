<?php

namespace App\Jobs;

use App\Models\Ticket;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class GenerateAppleWalletPass implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public readonly Ticket $ticket) {}

    public function handle(): void
    {
        // TODO: generate .pkpass and push via APNS in Phase 2
        Log::info("Apple Wallet pass generation queued for ticket {$this->ticket->uuid}");
    }
}
