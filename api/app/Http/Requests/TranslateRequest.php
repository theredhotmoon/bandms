<?php

namespace App\Http\Requests;

use App\Assistant\Translation\TranslationItem;
use App\Support\Locales;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * POST /api/admin/assistant/translate.
 *
 * Source and target sit on each item so one field's empty locales — possibly
 * with different sources — travel in one request. `required` on `text`
 * already rejects a whitespace-only string: there is nothing to translate.
 */
class TranslateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // auth:api guards the route; any signed-in user may translate
    }

    public function rules(): array
    {
        $codes = Locales::codes();

        return [
            'items'          => ['required', 'array', 'min:1', 'max:' . config('assistant.max_items')],
            'items.*.key'    => ['required', 'string', 'max:200'],
            'items.*.text'   => ['required', 'string', 'max:' . config('assistant.max_chars')],
            'items.*.format' => ['required', Rule::in(TranslationItem::FORMATS)],
            'items.*.source' => ['required', 'string', Rule::in($codes)],
            'items.*.target' => [
                'required', 'string', Rule::in($codes),
                function (string $attribute, mixed $value, \Closure $fail): void {
                    $index = explode('.', $attribute)[1] ?? null;
                    if ($index !== null && $this->input("items.{$index}.source") === $value) {
                        $fail('The target language must differ from the source language.');
                    }
                },
            ],
        ];
    }

    /** @return TranslationItem[] */
    public function items(): array
    {
        return array_map(fn (array $i) => new TranslationItem(
            key: $i['key'],
            text: $i['text'],
            format: $i['format'],
            source: $i['source'],
            target: $i['target'],
        ), $this->validated('items'));
    }
}
