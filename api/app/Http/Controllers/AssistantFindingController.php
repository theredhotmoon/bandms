<?php

namespace App\Http\Controllers;

use App\Models\AssistantFinding;
use App\Models\AssistantRun;
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

    public function runs(): JsonResponse
    {
        $runs = AssistantRun::query()
            ->whereIn('id', AssistantRun::query()->selectRaw('max(id)')->groupBy('source'))
            ->orderBy('source')
            ->get(['source', 'status', 'started_at', 'finished_at', 'queries', 'found', 'new', 'error']);

        return response()->json(['data' => $runs]);
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
            'saved_type' => $f->saved_type,
            'saved_id'   => $f->saved_id,
            'found_at'   => $f->found_at,
        ];
    }
}
