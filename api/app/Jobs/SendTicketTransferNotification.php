<?php

namespace App\Jobs;

use App\Models\TicketTransfer;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class SendTicketTransferNotification implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public readonly TicketTransfer $transfer) {}

    public function handle(): void
    {
        // TODO: send claim link email to recipient in Phase 2
        Log::info("Transfer notification queued for transfer {$this->transfer->id}");
    }
}
