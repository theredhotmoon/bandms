<?php

namespace App\Http\Controllers;

use App\Http\Resources\ConcertTicketTypeResource;
use App\Models\Concert;
use App\Models\ConcertTicketPriceTier;
use App\Models\ConcertTicketType;
use App\Models\OrderItem;
use App\Models\PromoCode;
use App\Models\Ticket;
use Endroid\QrCode\Builder\Builder;
use Endroid\QrCode\Writer\PngWriter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection; // used by index()
use Illuminate\Http\Response;
use ZipArchive;

class ConcertTicketController extends Controller
{
    // ── Public: list ticket types + availability ──────────────────────────

    public function index(Concert $concert): AnonymousResourceCollection
    {
        $concert->load('ticketTypes.tiers');

        // Pre-aggregate sold counts for all tiers in a single GROUP BY query
        $tierIds = $concert->ticketTypes->flatMap(fn ($t) => $t->tiers->pluck('id'));
        if ($tierIds->isNotEmpty()) {
            $soldCounts = OrderItem::whereIn('concert_ticket_price_tier_id', $tierIds)
                ->whereHas('order', fn ($q) => $q->whereIn('status', ['paid', 'pending']))
                ->selectRaw('concert_ticket_price_tier_id, SUM(quantity) as total')
                ->groupBy('concert_ticket_price_tier_id')
                ->pluck('total', 'concert_ticket_price_tier_id');

            $concert->ticketTypes->each(function ($type) use ($soldCounts) {
                $type->tiers->each(fn ($tier) => $tier->soldCountCache = (int) $soldCounts->get($tier->id, 0));
            });
        }

        // Set the concert relation on each type so isOnSale() can check the concert date
        // without triggering an extra query per ticket type.
        $concert->ticketTypes->each(fn ($t) => $t->setRelation('concert', $concert));

        return ConcertTicketTypeResource::collection($concert->ticketTypes);
    }

    // ── Admin: ticket type CRUD ───────────────────────────────────────────

    public function store(Request $request, Concert $concert): ConcertTicketTypeResource
    {
        $data = $request->validate([
            'name'           => 'required|string|max:255',
            'description'    => 'nullable|string|max:2000',
            'available_from' => 'nullable|date',
            'on_sale_until'  => 'nullable|date|after_or_equal:available_from',
            'max_per_order'  => 'nullable|integer|min:1|max:999',
            'sort_order'     => 'nullable|integer|min:0',
            'price'          => 'nullable|numeric|min:0',
            'currency'       => 'nullable|string|size:3',
            'total_tickets'  => 'nullable|integer|min:1',
        ]);

        $type = $concert->ticketTypes()->create(
            collect($data)->only(['name', 'description', 'available_from', 'on_sale_until', 'max_per_order', 'sort_order'])->all()
        );

        $price    = $data['price'] ?? null;
        $currency = $data['currency'] ?? null;
        if ($price !== null && $currency !== null) {
            $type->tiers()->create([
                'name'            => 'Standard',
                'price'           => $price,
                'currency'        => strtoupper($currency),
                'available_count' => $data['total_tickets'] ?? null,
                'sort_order'      => 0,
            ]);
        }

        $type->load('tiers');

        $warning = $this->capacityWarning($concert);

        $resource = new ConcertTicketTypeResource($type);

        if ($warning) {
            return $resource->additional(['warning' => $warning]);
        }

        return $resource;
    }

    public function update(Request $request, Concert $concert, ConcertTicketType $ticketType): ConcertTicketTypeResource
    {
        abort_unless($ticketType->concert_id === $concert->id, 404);

        $data = $request->validate([
            'name'           => 'sometimes|required|string|max:255',
            'description'    => 'nullable|string|max:2000',
            'available_from' => 'nullable|date',
            'on_sale_until'  => 'nullable|date',
            'max_per_order'  => 'nullable|integer|min:1|max:999',
            'sort_order'     => 'nullable|integer|min:0',
            'price'          => 'nullable|numeric|min:0',
            'currency'       => 'nullable|string|size:3',
            'total_tickets'  => 'nullable|integer|min:1',
        ]);

        $ticketType->update(
            collect($data)->only(['name', 'description', 'available_from', 'on_sale_until', 'max_per_order', 'sort_order'])->all()
        );

        $price    = $data['price'] ?? null;
        $currency = $data['currency'] ?? null;
        if ($price !== null && $currency !== null) {
            $tierData = [
                'price'           => $price,
                'currency'        => strtoupper($currency),
                'available_count' => $data['total_tickets'] ?? null,
            ];
            $ticketType->load('tiers');
            if ($ticketType->tiers->isEmpty()) {
                $ticketType->tiers()->create(array_merge(['name' => 'Standard', 'sort_order' => 0], $tierData));
            } elseif ($ticketType->tiers->count() === 1) {
                $ticketType->tiers->first()->update($tierData);
            }
            // 2+ tiers: use the per-tier edit UI
        }

        $ticketType->load('tiers');

        return new ConcertTicketTypeResource($ticketType);
    }

    public function destroy(Concert $concert, ConcertTicketType $ticketType): JsonResponse
    {
        abort_unless($ticketType->concert_id === $concert->id, 404);
        $ticketType->delete();

        return response()->json(null, 204);
    }

    // ── Admin: price tier CRUD ────────────────────────────────────────────

    public function storeTier(Request $request, Concert $concert, ConcertTicketType $ticketType): JsonResponse
    {
        abort_unless($ticketType->concert_id === $concert->id, 404);

        $data = $request->validate([
            'name'            => 'required|string|max:255',
            'price'           => 'required|numeric|min:0',
            'currency'        => 'required|string|size:3',
            'available_from'  => 'nullable|date',
            'available_until' => 'nullable|date|after_or_equal:available_from',
            'available_count' => 'nullable|integer|min:1',
            'sort_order'      => 'nullable|integer|min:0',
        ]);

        $tier = $ticketType->tiers()->create(
            collect($data)->only(['name', 'price', 'currency', 'available_from', 'available_until', 'available_count', 'sort_order'])->all()
        );

        return response()->json($tier, 201);
    }

    public function updateTier(Request $request, Concert $concert, ConcertTicketType $ticketType, ConcertTicketPriceTier $tier): JsonResponse
    {
        abort_unless($ticketType->concert_id === $concert->id, 404);
        abort_unless($tier->concert_ticket_type_id === $ticketType->id, 404);

        $data = $request->validate([
            'name'            => 'sometimes|required|string|max:255',
            'price'           => 'sometimes|required|numeric|min:0',
            'currency'        => 'sometimes|required|string|size:3',
            'available_from'  => 'nullable|date',
            'available_until' => 'nullable|date',
            'available_count' => 'nullable|integer|min:1',
            'sort_order'      => 'nullable|integer|min:0',
        ]);

        $tier->update($data);

        return response()->json($tier);
    }

    public function destroyTier(Concert $concert, ConcertTicketType $ticketType, ConcertTicketPriceTier $tier): JsonResponse
    {
        abort_unless($ticketType->concert_id === $concert->id, 404);
        abort_unless($tier->concert_ticket_type_id === $ticketType->id, 404);
        $tier->delete();

        return response()->json(null, 204);
    }

    // ── Admin: promo code CRUD ────────────────────────────────────────────

    public function promoCodes(): JsonResponse
    {
        $codes = PromoCode::with('ticketType')->latest()->get();

        return response()->json($codes);
    }

    public function storePromoCode(Request $request): JsonResponse
    {
        $data = $request->validate([
            'code'           => 'required|string|max:32|unique:promo_codes,code',
            'discount_type'  => 'required|in:percent,fixed',
            'value'          => 'required|numeric|min:0',
            'max_uses'       => 'nullable|integer|min:1',
            'expires_at'     => 'nullable|date',
            'ticket_type_id' => 'nullable|integer|exists:concert_ticket_types,id',
        ]);

        $code = PromoCode::create($data);

        return response()->json($code, 201);
    }

    public function destroyPromoCode(PromoCode $promoCode): JsonResponse
    {
        $promoCode->delete();

        return response()->json(null, 204);
    }

    // ── Admin: door check ─────────────────────────────────────────────────

    // GET /api/concerts/{concert}/tickets  (admin)
    public function adminTicketList(Concert $concert): JsonResponse
    {
        $tickets = Ticket::whereHas('concertTicketType', fn ($q) => $q->where('concert_id', $concert->id))
            ->with('concertTicketType')
            ->orderByDesc('created_at')
            ->get();

        return response()->json($tickets->map(fn ($t) => [
            'uuid'          => $t->uuid,
            'status'        => $t->status,
            'holder_name'   => $t->holder_name,
            'holder_email'  => $t->holder_email,
            'ticket_type'   => $t->concertTicketType?->name,
        ]));
    }

    public function qrCode(string $uuid): Response
    {
        if (! preg_match('/^[0-9a-f-]{36}$/i', $uuid)) {
            abort(404);
        }

        $ticket = Ticket::where('uuid', $uuid)->firstOrFail();

        if (in_array($ticket->status, ['voided', 'transferred'])) {
            abort(410, 'This ticket is no longer valid.');
        }

        $result = (new Builder(
            writer: new PngWriter(),
            data: $ticket->uuid,
            size: 200,
        ))->build();

        return response($result->getString(), 200, [
            'Content-Type'  => $result->getMimeType(),
            'Cache-Control' => 'public, max-age=3600',
        ]);
    }

    public function pdf(string $uuid): Response
    {
        if (! preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $uuid)) {
            abort(404);
        }

        $ticket = Ticket::where('uuid', $uuid)
            ->with(['concertTicketType.concert.venue'])
            ->firstOrFail();

        if (in_array($ticket->status, ['voided', 'transferred'])) {
            abort(410, 'This ticket is no longer valid.');
        }

        $qrBase64 = null;
        try {
            $result = (new Builder(
                writer: new PngWriter(),
                data: $uuid,
                size: 200,
                margin: 10,
            ))->build();

            $qrBase64 = base64_encode($result->getString());
        } catch (\Throwable) {
            // fall back to text-only UUID if QR generation fails
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

        if (in_array($ticket->status, ['voided', 'transferred'])) {
            abort(410, 'This ticket is no longer valid.');
        }

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

    public function walletGoogle(string $uuid): \Illuminate\Http\JsonResponse|\Illuminate\Http\RedirectResponse
    {
        if (! preg_match('/^[0-9a-f-]{36}$/i', $uuid)) {
            abort(404);
        }

        $ticket = Ticket::where('uuid', $uuid)
            ->with(['concertTicketType.concert.venue'])
            ->firstOrFail();

        if (in_array($ticket->status, ['voided', 'transferred'])) {
            abort(410, 'This ticket is no longer valid.');
        }

        if (! config('services.google_wallet.enabled', false)) {
            return response()->json([
                'message' => 'Google Wallet not configured',
                'uuid'    => $ticket->uuid,
            ]);
        }

        $jwt = $this->buildGoogleWalletJwt($ticket);

        return redirect("https://pay.google.com/gp/v/save/{$jwt}");
    }

    /**
     * Build a Google Wallet "Add to Wallet" JWT for the given ticket.
     *
     * Produces a RS256-signed JWT following Google's Save-to-Wallet format.
     * Requires GOOGLE_WALLET_ENABLED=true, GOOGLE_WALLET_SA_EMAIL,
     * GOOGLE_WALLET_ISSUER_ID, and GOOGLE_WALLET_SA_KEY to be set.
     */
    private function buildGoogleWalletJwt(Ticket $ticket): string
    {
        $issuerId = config('services.google_wallet.issuer_id');
        $saEmail  = config('services.google_wallet.sa_email');
        $saKey    = config('services.google_wallet.sa_key');

        $concert = $ticket->concertTicketType?->concert;
        $venue   = $concert?->venue;

        $payload = [
            'iss' => $saEmail,
            'aud' => 'google',
            'typ' => 'savetowallet',
            'iat' => time(),
            'payload' => [
                'eventTicketObjects' => [
                    [
                        'id'               => "{$issuerId}.{$ticket->uuid}",
                        'classId'          => "{$issuerId}.{$concert?->id}",
                        'state'            => 'ACTIVE',
                        'ticketHolderName' => $ticket->holder_name ?? '',
                        'ticketNumber'     => $ticket->uuid,
                        'barcode'          => [
                            'type'          => 'QR_CODE',
                            'value'         => $ticket->uuid,
                            'alternateText' => $ticket->uuid,
                        ],
                        'eventName' => [
                            'defaultValue' => [
                                'language' => 'en-US',
                                'value'    => $venue?->name ?? '',
                            ],
                        ],
                        'seatInfo' => [
                            'section' => [
                                'defaultValue' => [
                                    'language' => 'en-US',
                                    'value'    => 'GA',
                                ],
                            ],
                        ],
                        'faceValue' => [
                            'micros'       => 0,
                            'currencyCode' => 'PLN',
                        ],
                    ],
                ],
            ],
        ];

        $header = base64_encode(json_encode(['alg' => 'RS256', 'typ' => 'JWT']));
        $header = rtrim(strtr($header, '+/', '-_'), '=');

        $body = base64_encode(json_encode($payload));
        $body = rtrim(strtr($body, '+/', '-_'), '=');

        $signingInput = "{$header}.{$body}";

        $privateKey = openssl_pkey_get_private($saKey);
        openssl_sign($signingInput, $signature, $privateKey, OPENSSL_ALGO_SHA256);

        $sig = base64_encode($signature);
        $sig = rtrim(strtr($sig, '+/', '-_'), '=');

        return "{$signingInput}.{$sig}";
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

    // ── Helpers ───────────────────────────────────────────────────────────

    private function capacityWarning(Concert $concert): ?string
    {
        $capacity = $concert->venue?->capacity;
        if (! $capacity) return null;

        $concert->load('ticketTypes.tiers');
        $total = $concert->ticketTypes->flatMap->tiers->sum('available_count');

        if ($total > $capacity) {
            return "Total ticket capacity ({$total}) exceeds venue capacity ({$capacity}).";
        }

        return null;
    }
}
