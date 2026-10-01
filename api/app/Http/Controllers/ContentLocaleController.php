<?php

namespace App\Http\Controllers;

use App\Support\ContentLocales;
use App\Support\Locales;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * The band's content-language order (see App\Support\ContentLocales).
 *
 * Admin-only and never baked into the public site, so a write marks no
 * rebuild area dirty.
 */
class ContentLocaleController extends Controller
{
    public function show(): JsonResponse
    {
        return response()->json(['data' => ['order' => ContentLocales::order()]]);
    }

    public function update(Request $request): JsonResponse
    {
        $codes = Locales::codes();

        // The whole permutation, not just "the primary". Accepting a partial
        // list would make the stored order depend on normalise()'s append rule,
        // so what the band saved and what the form showed afterwards could
        // differ for any language they did not mention.
        $validated = $request->validate([
            'order'   => ['required', 'array', 'size:' . count($codes)],
            'order.*' => ['required', 'string', 'distinct', Rule::in($codes)],
        ]);

        ContentLocales::set($validated['order']);

        return response()->json(['data' => ['order' => ContentLocales::order()]]);
    }
}
