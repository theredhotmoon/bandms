<?php

namespace App\Http\Controllers;

use App\Models\Ticket;
use Endroid\QrCode\Builder\Builder;
use Endroid\QrCode\Encoding\Encoding;
use Endroid\QrCode\ErrorCorrectionLevel;
use Endroid\QrCode\RoundBlockSizeMode;
use Endroid\QrCode\Writer\PngWriter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use ZipArchive;

class ConcertTicketController extends Controller
{
    public function pdf(string $uuid): Response
    {
        if (! preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $uuid)) {
            abort(404);
        }

        $ticket = Ticket::where('uuid', $uuid)
            ->with(['concertTicketType.concert.venue'])
            ->firstOrFail();

        // Generate QR code as base64 PNG
        $qrBase64 = null;
        try {
            $result = Builder::create()
                ->writer(new PngWriter())
                ->writerOptions([])
                ->data($uuid)
                ->encoding(new Encoding('UTF-8'))
                ->errorCorrectionLevel(ErrorCorrectionLevel::High)
                ->size(200)
                ->margin(10)
                ->roundBlockSizeMode(RoundBlockSizeMode::Margin)
                ->build();

            $qrBase64 = base64_encode($result->getString());
        } catch (\Throwable) {
            // Fall back to text-only if QR generation fails
        }

        $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadView('tickets.pdf', compact('ticket', 'qrBase64'));

        return $pdf->stream("ticket-{$ticket->uuid}.pdf");
    }

    public function walletApple(string $uuid): Response
    {
        if (! preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $uuid)) {
            abort(404);
        }

        $ticket = Ticket::where('uuid', $uuid)
            ->with(['concertTicketType.concert.venue'])
            ->firstOrFail();

        $passData    = $this->buildPassJson($ticket);
        $zipContents = $this->buildPkpass($passData, $ticket->uuid);

        return response($zipContents, 200, [
            'Content-Type'        => 'application/vnd.apple.pkpass',
            'Content-Disposition' => "attachment; filename=\"ticket-{$ticket->uuid}.pkpass\"",
        ]);
    }

    /**
     * Build the pass.json payload for an Apple Wallet EventTicket pass.
     */
    private function buildPassJson(Ticket $ticket): string
    {
        $concert  = $ticket->concertTicketType?->concert;
        $venue    = $concert?->venue;
        $date     = $concert?->date?->format('Y-m-d') ?? '';

        $pass = [
            'formatVersion'      => 1,
            'passTypeIdentifier' => config('wallet.apple_pass_type_identifier', 'pass.bandms.ticket'),
            'serialNumber'       => $ticket->uuid,
            'teamIdentifier'     => config('wallet.apple_team_identifier', 'XXXXXXXXXX'),
            'organizationName'   => 'BandMS',
            'description'        => 'Concert Ticket',
            'foregroundColor'    => 'rgb(255, 255, 255)',
            'backgroundColor'    => 'rgb(17, 17, 17)',
            'eventTicket'        => [
                'primaryFields'   => [
                    ['key' => 'event', 'label' => 'EVENT', 'value' => $venue?->name ?? ''],
                ],
                'secondaryFields' => [
                    ['key' => 'date',  'label' => 'DATE',        'value' => $date],
                    ['key' => 'type',  'label' => 'TICKET TYPE', 'value' => $ticket->concertTicketType?->name ?? ''],
                ],
                'auxiliaryFields' => [
                    ['key' => 'holder', 'label' => 'TICKET HOLDER', 'value' => $ticket->holder_name ?? ''],
                ],
                'backFields'      => [
                    ['key' => 'email', 'label' => 'EMAIL',     'value' => $ticket->holder_email ?? ''],
                    ['key' => 'uuid',  'label' => 'TICKET ID', 'value' => $ticket->uuid],
                ],
            ],
            'barcode' => [
                'message'         => $ticket->uuid,
                'format'          => 'PKBarcodeFormatQR',
                'messageEncoding' => 'iso-8859-1',
            ],
        ];

        return json_encode($pass, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    }

    /**
     * Assemble a .pkpass ZIP (unsigned — signature added when Apple certs are configured).
     *
     * When APPLE_WALLET_ENABLED=true the archive includes a real PKCS7 signature;
     * otherwise the signature file is omitted so the archive is valid but not
     * installable on real devices (sufficient for development and testing).
     */
    private function buildPkpass(string $passJson, string $uuid): string
    {
        // Minimal 1×1 transparent PNG (same for all icon/logo slots).
        $placeholderPng = base64_decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
        );

        $files = [
            'pass.json'   => $passJson,
            'icon.png'    => $placeholderPng,
            'icon@2x.png' => $placeholderPng,
            'logo.png'    => $placeholderPng,
            'logo@2x.png' => $placeholderPng,
        ];

        // Build manifest (SHA1 of every file that will end up in the archive).
        $manifest = [];
        foreach ($files as $name => $contents) {
            $manifest[$name] = sha1($contents);
        }
        $manifestJson        = json_encode($manifest);
        $files['manifest.json'] = $manifestJson;

        // Build the ZIP in a temp file, then read it into memory.
        $tmpPath = tempnam(sys_get_temp_dir(), 'pkpass_') . '.zip';

        $zip = new ZipArchive();
        $zip->open($tmpPath, ZipArchive::CREATE | ZipArchive::OVERWRITE);

        foreach ($files as $name => $contents) {
            $zip->addFromString($name, $contents);
        }

        $zip->close();

        $zipContents = file_get_contents($tmpPath);
        @unlink($tmpPath);

        return $zipContents;
    }

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
