<?php

namespace App\Http\Controllers;

use App\Assistant\Crawler\CapLedger;
use App\Assistant\Crawler\CrawlDispatcher;
use App\Assistant\Crawler\SourceRegistry;
use App\Models\AssistantFinding;
use App\Models\AssistantRun;
use App\Models\Author;
use App\Models\Band;
use App\Models\Venue;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * The crawler's inbox. Lists findings (new by default, newest first) with the
 * per-country and per-kind counts the filter chips show, dismisses or
 * restores one, and reports each source's last run for the status bar.
 * Saving a lead as a venue/band/author arrives with slice 3.
 */
class AssistantFindingController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $v = $request->validate([
            'kind'    => ['nullable', Rule::in(AssistantFinding::KINDS)],
            'country' => ['nullable', 'string', 'size:2'],
            'status'  => ['nullable', Rule::in(AssistantFinding::STATUSES)],
            'q'       => ['nullable', 'string', 'max:100'],
        ]);

        $status = $v['status'] ?? 'new';
        $base   = AssistantFinding::query()->status($status);
        if (!empty($v['q'])) {
            $like = '%' . str_replace(['%', '_'], ['\%', '\_'], $v['q']) . '%';
            $base->where(fn ($w) => $w->where('title', 'like', $like)->orWhere('snippet', 'like', $like));
        }

        // Chips count within the other filters, so the numbers match the list.
        $countries = (clone $base)
            ->when($v['kind'] ?? null, fn ($q, $k) => $q->kind($k))
            ->whereNotNull('country')
            ->selectRaw('country, count(*) as n')->groupBy('country')->orderBy('country')
            ->pluck('n', 'country')->map(fn ($n) => (int) $n);
        $kinds = (clone $base)
            ->when($v['country'] ?? null, fn ($q, $c) => $q->country($c))
            ->selectRaw('kind, count(*) as n')->groupBy('kind')
            ->pluck('n', 'kind')->map(fn ($n) => (int) $n);

        $page = $base
            ->when($v['kind'] ?? null, fn ($q, $k) => $q->kind($k))
            ->when($v['country'] ?? null, fn ($q, $c) => $q->country($c))
            ->orderByDesc('score')->orderByDesc('found_at')->orderByDesc('id')
            ->paginate(50);

        return response()->json([
            'data' => collect($page->items())->map(fn (AssistantFinding $f) => $this->format($f))->all(),
            'meta' => [
                'countries' => $countries,
                'kinds'     => $kinds,
                'total'     => $page->total(),
                'page'      => $page->currentPage(),
                'last_page' => $page->lastPage(),
            ],
        ]);
    }

    public function update(Request $request, AssistantFinding $finding): JsonResponse
    {
        // `saved` is set by Save as… (slice 3), never by hand.
        $v = $request->validate(['status' => ['required', Rule::in(['new', 'dismissed'])]]);
        if ($finding->status === 'saved') {
            return response()->json([
                'message' => 'A saved finding stays saved.',
                'errors'  => ['status' => ['A saved finding stays saved.']],
            ], 422);
        }
        $finding->update($v);

        return response()->json(['data' => $this->format($finding)]);
    }

    /**
     * Each source's last run, with what is left of today's cap and how many
     * of its latest runs failed in a row — three is the status bar's banner.
     */
    public function runs(): JsonResponse
    {
        $runs = AssistantRun::query()
            ->whereIn('id', AssistantRun::query()->selectRaw('max(id)')->groupBy('source'))
            ->orderBy('source')
            ->get(['source', 'status', 'started_at', 'finished_at', 'queries', 'found', 'new', 'error'])
            ->map(fn (AssistantRun $run) => $run->toArray() + [
                'remaining'    => CapLedger::remaining($run->source),
                'failing_runs' => $this->failingRuns($run->source),
            ]);

        return response()->json(['data' => $runs]);
    }

    /**
     * Save as…, second half: the record was created through its own endpoint
     * (its validation, its 422s), and this links it. Until then the finding
     * stays new — a failed create leaves nothing half-saved.
     */
    public function saved(Request $request, AssistantFinding $finding): JsonResponse
    {
        $models = ['venue' => Venue::class, 'band' => Band::class, 'author' => Author::class];
        $v = $request->validate([
            'type' => ['required', Rule::in(array_keys($models))],
            'id'   => ['required', 'integer'],
        ]);
        $record = $models[$v['type']]::query()->find($v['id']);
        if (!$record) {
            return response()->json(['message' => 'No such record.', 'errors' => ['id' => ['No such record.']]], 422);
        }

        // Locked, so two clicks (or two tabs) cannot both link the same finding.
        $refused = DB::transaction(function () use ($finding, $record, $v) {
            $locked = AssistantFinding::query()->lockForUpdate()->findOrFail($finding->id);
            if ($locked->kind !== 'lead' || $locked->status !== 'new') {
                return 'Only a new lead can be saved.';
            }
            // Where it came from — unless the band already said.
            if (($record->source ?? null) === null) {
                $record->update(['source' => "assistant:{$finding->id}"]);
            }
            $locked->update(['status' => 'saved', 'saved_type' => $v['type'], 'saved_id' => $record->id]);

            return null;
        });
        if ($refused !== null) {
            return response()->json(['message' => $refused, 'errors' => ['id' => [$refused]]], 422);
        }

        return response()->json(['data' => $this->format($finding->fresh())]);
    }

    /** The dashboard widget: new findings per kind, the last finished run, failing sources. */
    public function summary(): JsonResponse
    {
        // What is worth a look: new, and either not triaged yet or kept by
        // triage (known names, duplicates and irrelevant ones score 0).
        $counts = AssistantFinding::query()->status('new')
            ->where(fn ($q) => $q->whereNull('triaged_at')->orWhere('score', '>', 0))
            ->selectRaw('kind, count(*) as n')->groupBy('kind')->pluck('n', 'kind');
        $latest = AssistantRun::query()->whereIn('id', AssistantRun::query()->selectRaw('max(id)')->groupBy('source'));

        return response()->json(['data' => [
            'new'             => collect(AssistantFinding::KINDS)->sort()->mapWithKeys(fn ($k) => [$k => (int) ($counts[$k] ?? 0)])->all(),
            'last_run_at'     => AssistantRun::query()->max('finished_at'),
            'failing_sources' => (clone $latest)->where('status', 'failed')->count(),
        ]]);
    }

    /** Run now: queue the crawl (one source, or every one that may run). */
    public function run(Request $request, SourceRegistry $registry, CrawlDispatcher $dispatcher): JsonResponse
    {
        $v = $request->validate(['source' => ['nullable', 'string', Rule::in($registry->keys())]]);

        return response()->json(['data' => $dispatcher->dispatch($v['source'] ?? null)], 202);
    }

    private function failingRuns(string $source): int
    {
        $streak = 0;
        foreach (AssistantRun::query()->where('source', $source)->latest('id')->limit(10)->pluck('status') as $status) {
            if ($status !== 'failed') {
                break;
            }
            $streak++;
        }

        return $streak;
    }

    private function format(AssistantFinding $f): array
    {
        return [
            'id'         => $f->id,
            'kind'       => $f->kind,
            'source'     => $f->source,
            'url'        => $f->url,
            'title'      => $f->title,
            'snippet'    => $f->snippet,
            'country'    => $f->country,
            'lead_type'  => $f->lead_type,
            'score'      => $f->score,
            'status'     => $f->status,
            'summary'    => $f->triage['summary'] ?? null,
            // What triage knew: a record the band already has, the same page
            // found earlier, and contacts read off the finding (Save as… prefill).
            'known'        => $f->triage['known'] ?? null,
            'duplicate_of' => $f->triage['duplicate_of'] ?? null,
            'contacts'     => $f->triage['contacts'] ?? null,
            'saved_type' => $f->saved_type,
            'saved_id'   => $f->saved_id,
            'found_at'   => $f->found_at,
        ];
    }
}
