<?php

namespace App\Http\Requests;

use App\Support\ClipOwners;
use App\Support\EmbedProvider;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ClipRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // role:admin middleware guards the route
    }

    /** Stamp the detected provider from the URL, as PostRules does for embeds. */
    protected function prepareForValidation(): void
    {
        if (is_string($this->input('url'))) {
            $this->merge(['provider' => EmbedProvider::detect($this->input('url'))]);
        }
    }

    public function rules(): array
    {
        $create = $this->isMethod('post');

        return [
            'url'          => [$create ? 'required' : 'sometimes', 'string', 'url', 'max:2048'],
            'provider'     => ['nullable', Rule::in(EmbedProvider::PROVIDERS)],
            'title'        => 'nullable|array',
            'title.en'     => 'nullable|string|max:255',
            'title.pl'     => 'nullable|string|max:255',
            'category'     => 'nullable|string|max:64',
            'recorded_on'  => 'nullable|date_format:Y-m-d',
            'show_in_epk'  => 'nullable|boolean',
            'attach'       => 'sometimes|array',
            'attach.*.type' => ['required', Rule::in(ClipOwners::aliases())],
            'attach.*.id'   => ['required', 'integer', function (string $attribute, mixed $value, \Closure $fail) {
                // $attribute is "attach.3.id" — the sibling type decides the table.
                $index = explode('.', $attribute)[1];
                $type  = $this->input("attach.$index.type");
                if (! is_string($type) || ! array_key_exists($type, ClipOwners::MAP)) {
                    return; // attach.*.type already reports this
                }
                if (! ClipOwners::MAP[$type]::whereKey($value)->exists()) {
                    $fail("The selected {$type} does not exist.");
                }
            }],
        ];
    }
}
