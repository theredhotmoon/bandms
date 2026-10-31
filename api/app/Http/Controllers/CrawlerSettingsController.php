<?php

namespace App\Http\Controllers;

use App\Assistant\Crawler\SourceRegistry;
use App\Models\AssistantRun;
use App\Support\CrawlerSettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * The crawler's settings page. Superadmin-only: these decide how much of each
 * provider's quota (and, for Places and the triage model, money) is spent,
 * which is the same decision as who may use Translate and Enhance.
 */
class CrawlerSettingsController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        if ($denied = $this->superadminOnly($request)) {
            return $denied;
        }

        return $this->respond(CrawlerSettings::get());
    }

    public function update(Request $request): JsonResponse
    {
        if ($denied = $this->superadminOnly($request)) {
            return $denied;
        }

        $sources = array_keys(CrawlerSettings::SOURCES);
        $data    = $request->validate([
            'keywords'              => ['sometimes', 'array', 'max:20'],
            'keywords.*'            => ['string', 'max:100'],
            'countries'             => ['sometimes', 'array', 'max:60'],
            'countries.*'           => ['string', Rule::in(CrawlerSettings::knownCountries())],
            'cities_by_country'     => ['sometimes', 'array'],
            'cities_by_country.*'   => ['array', 'max:10'],
            'cities_by_country.*.*' => ['string', 'max:100'],
            'sources'               => ['sometimes', 'array'],
            'sources.*'             => ['array'],
            'sources.*.enabled'     => ['sometimes', 'boolean'],
            'sources.*.cap_day'     => ['sometimes', 'integer', 'min:0'],
            'sources.*.cap_month'   => ['sometimes', 'integer', 'min:0'],
            'rss_feeds'             => ['sometimes', 'array', 'max:20'],
            'rss_feeds.*'           => ['url', 'max:500'],
            'sibling_bands'         => ['sometimes', 'array', 'max:30'],
            'sibling_bands.*.mbid'  => ['required', 'string', 'max:64'],
            'sibling_bands.*.name'  => ['required', 'string', 'max:200'],
            'digest_to'             => ['sometimes', 'array', 'max:10'],
            'digest_to.*'           => ['email:rfc', 'max:255'],
        ]);

        if (isset($data['sources']) && array_diff(array_keys($data['sources']), $sources) !== []) {
            return response()->json(['message' => 'Unknown source.', 'errors' => ['sources' => ['Unknown source.']]], 422);
        }
        // Merge per source, so a PUT of one toggle keeps that source's caps.
        if (isset($data['sources'])) {
            $current = CrawlerSettings::get()['sources'];
            foreach ($data['sources'] as $key => $given) {
                $data['sources'][$key] = array_replace($current[$key], $given);
            }
            $data['sources'] = array_replace($current, $data['sources']);
        }

        return $this->respond(CrawlerSettings::set($data));
    }

    private function respond(array $settings): JsonResponse
    {
        $lastRuns = AssistantRun::query()
            ->whereIn('id', AssistantRun::query()->selectRaw('max(id)')->groupBy('source'))
            ->get()->keyBy('source');

        $built   = app(SourceRegistry::class)->keys();
        $sources = [];
        foreach ($settings['sources'] as $key => $s) {
            $run       = $lastRuns->get($key);
            $sources[] = [
                'key'     => $key,
                // Settings exist for every planned source; only registered ones run.
                'available' => in_array($key, $built, true),
                'enabled' => $s['enabled'],
                'hasKey'  => !CrawlerSettings::keyMissing($key),
                'cap_day' => $s['cap_day'],
                'cap_month' => $s['cap_month'] ?? null,
                'lastRun' => $run ? [
                    'status'      => $run->status,
                    'started_at'  => $run->started_at,
                    'finished_at' => $run->finished_at,
                    'queries'     => $run->queries,
                    'new'         => $run->new,
                    'error'       => $run->error,
                ] : null,
            ];
        }

        return response()->json([
            'data'      => $settings,
            'sources'   => $sources,
            'countries' => collect(config('countries'))->map(fn ($c, $code) => ['code' => $code, 'name' => $c['name'], 'native' => $c['native']])->values(),
        ]);
    }

    private function superadminOnly(Request $request): ?JsonResponse
    {
        return $request->user()?->is_superadmin
            ? null
            : response()->json(['message' => 'Only a superadmin can manage the crawler.'], 403);
    }
}
