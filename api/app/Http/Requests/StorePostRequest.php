<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\PostRules;
use App\Models\Post;
use Illuminate\Foundation\Http\FormRequest;

class StorePostRequest extends FormRequest
{
    use PostRules;

    public function authorize(): bool
    {
        return true; // route is behind auth:api
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('blocks')) {
            $this->merge(['blocks' => $this->normaliseBlocks($this->input('blocks', []))]);
        }
    }

    public function rules(): array
    {
        return $this->sharedRules() + $this->blockPayloadRules($this->input('blocks', [])) + [
            'title'   => 'required',
        ] + Post::translatedSlugRules(null);
    }
}
