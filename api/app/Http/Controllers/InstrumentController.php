<?php

namespace App\Http\Controllers;

use App\Enums\StagePlotType;
use App\Http\Resources\InstrumentResource;
use App\Models\Instrument;
use App\Support\Locales;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class InstrumentController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        // Ordered by the request's own locale's JSON path, matching what
        // InstrumentResource actually resolves and displays for this
        // response — sorting by the raw `name` column would sort by its
        // JSON-encoded text instead of the displayed value.
        return InstrumentResource::collection(
            Instrument::orderBy('category')->orderBy('name->' . app()->getLocale())->get()
        );
    }

    public function store(Request $request): InstrumentResource
    {
        $data = $request->validate($this->rules());

        $instrument = new Instrument();
        $instrument->category = $data['category'] ?? null;
        $instrument->stage_plot_type = $data['stage_plot_type'] ?? null;
        $this->fill($instrument, $data);
        $this->assertHasName($instrument);
        $instrument->save();

        return new InstrumentResource($instrument);
    }

    public function update(Request $request, Instrument $instrument): InstrumentResource
    {
        $data = $request->validate($this->rules($instrument));

        $instrument->category = $data['category'] ?? null;
        $instrument->stage_plot_type = $data['stage_plot_type'] ?? null;
        $this->fill($instrument, $data);
        $this->assertHasName($instrument);
        $instrument->save();

        return new InstrumentResource($instrument);
    }

    public function destroy(Instrument $instrument): JsonResponse
    {
        $instrument->delete();

        return response()->json(null, 204);
    }

    /**
     * Per-locale rules generated from the registry, mirroring TagController.
     */
    private function rules(?Instrument $instrument = null): array
    {
        $rules = [
            'name'            => ['required', 'array', $this->localeKeysOnly()],
            'category'        => ['nullable', 'string', 'max:100'],
            'stage_plot_type' => ['nullable', 'string', Rule::in(StagePlotType::values())],
        ];

        foreach (Locales::codes() as $code) {
            $rules["name.{$code}"] = [
                'sometimes', 'nullable', 'string', 'max:100',
                Rule::unique('instruments', "name->{$code}")->ignore($instrument),
            ];
        }

        return $rules;
    }

    /**
     * Rejects a name payload carrying keys that are not registered locales —
     * an unsupported key would otherwise pass validation and be silently
     * dropped by fill(), saving the instrument with that text thrown away.
     */
    private function localeKeysOnly(): \Closure
    {
        return function (string $attribute, mixed $value, \Closure $fail) {
            if (!is_array($value)) {
                return;
            }

            $unknown = Locales::unsupportedKeys($value);

            if ($unknown !== []) {
                $fail("The {$attribute} field only accepts the locales "
                    . implode(' and ', Locales::codes()) . '.');
            }
        };
    }

    /**
     * An instrument must survive in at least one locale, same rationale as
     * TagController::assertHasName — an all-blank name would render an empty
     * row on the public site rather than 500ing at save time.
     */
    private function assertHasName(Instrument $instrument): void
    {
        $filled = collect($instrument->getTranslations('name'))->filter(fn ($v) => filled($v));

        if ($filled->isEmpty()) {
            $message = 'An instrument name is required in at least one language.';

            throw \Illuminate\Validation\ValidationException::withMessages(
                collect(Locales::codes())
                    ->mapWithKeys(fn (string $code) => ["name.{$code}" => [$message]])
                    ->all(),
            );
        }
    }

    /**
     * setTranslations() merges into the existing array, so omitting a locale
     * would leave its old value in place — clearing has to be an explicit
     * forgetTranslation(). Only locales the request actually names are
     * touched, so a single-locale payload cannot wipe the other language.
     */
    private function fill(Instrument $instrument, array $data): void
    {
        if (!array_key_exists('name', $data)) {
            return;
        }

        foreach (Locales::codes() as $locale) {
            if (!array_key_exists($locale, $data['name'])) {
                continue;
            }

            filled($data['name'][$locale])
                ? $instrument->setTranslation('name', $locale, $data['name'][$locale])
                : $instrument->forgetTranslation('name', $locale);
        }
    }
}
