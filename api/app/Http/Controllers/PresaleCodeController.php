<?php

namespace App\Http\Controllers;

use App\Models\PresaleCode;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class PresaleCodeController extends Controller
{
    /**
     * GET /api/presale-codes
     * Admin: list presale codes, optionally filtered by concert.
     */
    public function index(Request $request): JsonResponse
    {
        $codes = PresaleCode::with('tiers')
            ->when($request->concert_id, fn ($q, $id) => $q->where('concert_id', $id))
            ->orderByDesc('created_at')
            ->get()
            ->map(fn ($c) => [
                'id'          => $c->id,
                'code'        => $c->code,
                'concert_id'  => $c->concert_id,
                'description' => $c->description,
                'used_count'  => $c->used_count,
                'max_uses'    => $c->max_uses,
                'valid_from'  => $c->valid_from?->toIso8601String(),
                'valid_until' => $c->valid_until?->toIso8601String(),
                'tier_ids'    => $c->tiers->pluck('id')->all(),
            ]);

        return response()->json($codes);
    }

    /**
     * POST /api/presale-codes
     * Admin: create one or many presale codes (bulk generation via count).
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'code'        => 'nullable|string|max:64|unique:presale_codes,code',
            'concert_id'  => 'nullable|integer|exists:concerts,id',
            'max_uses'    => 'nullable|integer|min:1',
            'valid_from'  => 'nullable|date',
            'valid_until' => 'nullable|date|after_or_equal:valid_from',
            'description' => 'required|string|max:255',
            'tier_ids'    => 'array',
            'tier_ids.*'  => 'integer|exists:concert_ticket_price_tiers,id',
            'count'       => 'nullable|integer|min:1|max:100',
        ]);

        $count = $data['count'] ?? 1;
        $codes = [];

        for ($i = 0; $i < $count; $i++) {
            if ($count === 1) {
                $code = $data['code'] ?? Str::upper(Str::random(8));
            } else {
                $code = Str::upper(Str::random(8));
            }

            $presale = PresaleCode::create([
                'code'        => $code,
                'concert_id'  => $data['concert_id'] ?? null,
                'max_uses'    => $data['max_uses'] ?? null,
                'used_count'  => 0,
                'valid_from'  => $data['valid_from'] ?? null,
                'valid_until' => $data['valid_until'] ?? null,
                'description' => $data['description'],
            ]);

            if (! empty($data['tier_ids'])) {
                $presale->tiers()->sync($data['tier_ids']);
            }

            $presale->load('tiers');

            $codes[] = [
                'id'          => $presale->id,
                'code'        => $presale->code,
                'concert_id'  => $presale->concert_id,
                'description' => $presale->description,
                'used_count'  => $presale->used_count,
                'max_uses'    => $presale->max_uses,
                'valid_from'  => $presale->valid_from?->toIso8601String(),
                'valid_until' => $presale->valid_until?->toIso8601String(),
                'tier_ids'    => $presale->tiers->pluck('id')->all(),
            ];
        }

        return response()->json($codes, 201);
    }

    /**
     * DELETE /api/presale-codes/{id}
     * Admin: delete a presale code.
     */
    public function destroy(int $id): JsonResponse
    {
        PresaleCode::findOrFail($id)->delete();

        return response()->json(null, 204);
    }

    /**
     * POST /api/presale-codes/validate
     * Public: validate a presale code for a given concert.
     */
    public function validate(Request $request): JsonResponse
    {
        $data = $request->validate([
            'code'       => 'required|string|max:64',
            'concert_id' => 'required|integer',
        ]);

        $presale = PresaleCode::with('tiers')
            ->where('code', $data['code'])
            ->where(fn ($q) => $q
                ->where('concert_id', $data['concert_id'])
                ->orWhereNull('concert_id')
            )
            ->first();

        if (! $presale) {
            return response()->json(['valid' => false, 'message' => 'Invalid code.']);
        }

        if ($presale->valid_from && $presale->valid_from->gt(now())) {
            return response()->json(['valid' => false, 'message' => 'Code not yet active.']);
        }

        if ($presale->valid_until && $presale->valid_until->lt(now())) {
            return response()->json(['valid' => false, 'message' => 'Code has expired.']);
        }

        if ($presale->max_uses !== null && $presale->used_count >= $presale->max_uses) {
            return response()->json(['valid' => false, 'message' => 'Code has reached its usage limit.']);
        }

        return response()->json([
            'valid'    => true,
            'tier_ids' => $presale->tiers->pluck('id')->all(),
        ]);
    }
}
