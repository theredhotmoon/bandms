<?php

namespace App\Http\Controllers;

use App\Assistant\Text\NullTextModel;
use App\Assistant\Text\RewriteResult;
use App\Assistant\Text\TextModel;
use App\Assistant\Text\TextModelUnavailable;
use App\Assistant\Translation\NullTranslator;
use App\Assistant\Translation\Translator;
use App\Assistant\Translation\TranslatorUnavailable;
use App\Http\Requests\RewriteFormRequest;
use App\Http\Requests\TranslateRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * The admin assistant's endpoints. Thin: validate, hand to the bound driver,
 * shape the answer. Any authenticated user may call them — publishers edit
 * translated posts too — so none of these routes sits behind role:admin.
 */
class AssistantController extends Controller
{
    public function __construct(
        private readonly Translator $translator,
        private readonly TextModel $textModel,
    ) {}

    /**
     * What the admin may offer. A capability reported false means the control
     * is not rendered at all (the ALWAYS_ON_MODULES rule: no control that
     * nobody can enable from the UI).
     */
    public function capabilities(Request $request): JsonResponse
    {
        $user = $request->user();

        // Per user: the provider must be configured AND a superadmin must have
        // allowed this user. The admin renders a control only for `true`, so a
        // disabled user never sees ↔ or ✦.
        return response()->json(['data' => [
            'translate' => !($this->translator instanceof NullTranslator) && $user->mayTranslate(),
            'rewrite'   => !($this->textModel instanceof NullTextModel) && $user->mayEnhance(),
        ]]);
    }

    /**
     * All-or-nothing for the items given; the admin sends one request per
     * form field, so a failure costs one field, not the whole form.
     */
    public function translate(TranslateRequest $request): JsonResponse
    {
        // Enforced here, not only by hiding the button: tokens are the point.
        if (!$request->user()->mayTranslate()) {
            return response()->json(['message' => "Translation isn't enabled for your account."], 403);
        }

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

    /** One rewrite of one field in one mode; the result is shown, never saved. */
    public function rewrite(RewriteFormRequest $request): JsonResponse
    {
        if (!$request->user()->mayEnhance()) {
            return response()->json(['message' => "Enhance isn't enabled for your account."], 403);
        }

        $rewrite = $request->toRewrite();

        try {
            $text = RewriteResult::clean($this->textModel->rewrite($rewrite), $rewrite->text);
        } catch (TextModelUnavailable $e) {
            return response()->json(['message' => $e->userMessage], 503);
        }

        // Length is a contract: the field's cap was in the prompt, and a result
        // over it would 422 at Save after Enhance reported success. Markup the
        // editor never produces must not reach the public site through here.
        if (mb_strlen($text) > $rewrite->maxLength) {
            return response()->json(['message' => 'The rewrite came out too long — try shorter.'], 503);
        }
        if ($rewrite->format === 'html' && RewriteResult::isUnsafeHtml($text)) {
            Log::warning('assistant.rewrite.unsafe_html', ['fieldKey' => $rewrite->fieldKey]);

            return response()->json(['message' => 'Rewrite failed — try again.'], 503);
        }

        Log::info('assistant.rewrite', [
            'mode' => $rewrite->mode->value, 'fieldKey' => $rewrite->fieldKey,
            'chars_in' => mb_strlen($rewrite->text), 'chars_out' => mb_strlen($text),
            'examples' => count($rewrite->examples), 'model' => config('assistant.text_model_id'),
        ]);

        return response()->json(['data' => [
            'text'     => $text,
            'mode'     => $rewrite->mode->value,
            'provider' => $this->textModel->name(),
            'model'    => config('assistant.text_model_id'),
        ]]);
    }
}
