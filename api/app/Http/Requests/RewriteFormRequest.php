<?php

namespace App\Http\Requests;

use App\Assistant\Text\RewriteMode;
use App\Assistant\Text\RewriteRequest;
use App\Assistant\Text\StyleExamples;
use App\Support\Locales;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * POST /api/admin/assistant/rewrite. `maxLength` is the field's own cap (the
 * column rule the form already knows); the prompt states it and the result
 * is held to it, so Enhance can never hand back text that Save would 422.
 */
class RewriteFormRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // auth:api guards the route; any signed-in user may rewrite
    }

    public function rules(): array
    {
        $cap = (int) config('assistant.rewrite_max_chars', 20000);
        // The input is held to the field's own cap too: a text already over
        // what Save accepts has nothing to gain from a rewrite.
        $field = (int) $this->input('maxLength', $cap);
        $textCap = $field > 0 ? min($field, $cap) : $cap;

        return [
            'text'      => ['required', 'string', 'max:' . $textCap],
            'format'    => ['required', Rule::in(RewriteRequest::FORMATS)],
            'locale'    => ['required', 'string', Rule::in(Locales::codes())],
            'mode'      => ['required', Rule::in(RewriteMode::values())],
            'fieldKey'  => ['required', 'string', 'max:200'],
            'maxLength' => ['sometimes', 'integer', 'min:1', 'max:' . $cap],
        ];
    }

    public function toRewrite(): RewriteRequest
    {
        $v         = $this->validated();
        $maxLength = min((int) ($v['maxLength'] ?? config('assistant.rewrite_max_chars')), (int) config('assistant.rewrite_max_chars'));

        return new RewriteRequest(
            text: $v['text'],
            format: $v['format'],
            locale: $v['locale'],
            mode: RewriteMode::from($v['mode']),
            fieldKey: $v['fieldKey'],
            maxLength: $maxLength,
            examples: StyleExamples::for($v['fieldKey'], $v['locale'], $v['text']),
        );
    }
}
