<?php

namespace App\Http\Controllers;

use App\Assistant\Translation\NullTranslator;
use App\Assistant\Translation\Translator;
use App\Assistant\Translation\TranslatorUnavailable;
use App\Http\Requests\TranslateRequest;
use Illuminate\Http\JsonResponse;

/**
 * The admin assistant's endpoints. Thin: validate, hand to the bound driver,
 * shape the answer. Any authenticated user may call them — publishers edit
 * translated posts too — so neither route sits behind role:admin.
 */
class AssistantController extends Controller
{
    public function __construct(private readonly Translator $translator) {}

    /**
     * What the admin may offer. A capability reported false means the button
     * is not rendered at all (the ALWAYS_ON_MODULES rule: no control that
     * nobody can enable from the UI).
     */
    public function capabilities(): JsonResponse
    {
        return response()->json(['data' => [
            'translate' => !($this->translator instanceof NullTranslator),
            'rewrite'   => false,
        ]]);
    }

    /**
     * All-or-nothing for the items given; the admin sends one request per
     * form field, so a failure costs one field, not the whole form.
     */
    public function translate(TranslateRequest $request): JsonResponse
    {
        $items = $request->items();

        try {
            $translated = $this->translator->translate($items);
        } catch (TranslatorUnavailable $e) {
            return response()->json(['message' => $e->userMessage], 503);
        }

        return response()->json(['data' => [
            'items'    => array_map(fn ($i) => ['key' => $i->key, 'text' => $translated[$i->key]], $items),
            'provider' => $this->translator->name(),
        ]]);
    }
}
