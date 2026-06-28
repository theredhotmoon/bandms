<?php

namespace App\Http\Controllers;

use App\Http\Resources\ConcertTicketTypeResource;
use App\Models\Concert;
use App\Models\ConcertTicketPriceTier;
use App\Models\ConcertTicketType;
use App\Models\OrderItem;
use App\Models\PromoCode;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection; // used by index()

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

    public function doorCheck(Request $request): JsonResponse
    {
        $request->validate(['code' => 'required|string']);

        $item = OrderItem::where('ticket_code', $request->code)
            ->with(['order', 'concertTicketType.concert'])
            ->first();

        if (! $item) {
            return response()->json(['valid' => false, 'reason' => 'Unknown ticket code.'], 200);
        }

        if ($item->order->status->value !== 'paid') {
            return response()->json(['valid' => false, 'reason' => 'Order not paid.'], 200);
        }

        return response()->json([
            'valid'       => true,
            'scanned'     => $item->scanned_at !== null,
            'scanned_at'  => $item->scanned_at?->toIso8601String(),
            'ticket_type' => $item->concertTicketType?->name,
            'concert'     => $item->concertTicketType?->concert?->name,
            'concert_date'=> $item->concertTicketType?->concert?->date?->toDateString(),
            'customer'    => $item->order->name,
            'order_uuid'  => $item->order->uuid,
        ]);
    }

    public function doorScan(Request $request): JsonResponse
    {
        $request->validate(['code' => 'required|string']);

        $item = OrderItem::where('ticket_code', $request->code)
            ->with(['order', 'concertTicketType.concert'])
            ->first();

        if (! $item) {
            return response()->json(['valid' => false, 'reason' => 'Unknown ticket code.'], 200);
        }

        if ($item->order->status->value !== 'paid') {
            return response()->json(['valid' => false, 'reason' => 'Order not paid.'], 200);
        }

        if ($item->scanned_at === null) {
            $item->update(['scanned_at' => now()]);
        }

        return response()->json([
            'valid'       => true,
            'scanned'     => true,
            'scanned_at'  => $item->scanned_at?->toIso8601String(),
            'ticket_type' => $item->concertTicketType?->name,
            'concert'     => $item->concertTicketType?->concert?->name,
            'concert_date'=> $item->concertTicketType?->concert?->date?->toDateString(),
            'customer'    => $item->order->name,
            'order_uuid'  => $item->order->uuid,
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
