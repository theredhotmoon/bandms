<?php

namespace App\Http\Controllers;

use App\Models\ActivityChange;
use App\Models\ActivityLog;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/**
 * The admin's read of the activity log: who changed what, and when.
 * Writing is App\Support\Activity\ActivityRecorder's job alone.
 */
class ActivityLogController extends Controller
{
    private const PER_PAGE = 25;

    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'subject_type' => ['nullable', 'string', 'max:64'],
            'subject_id'   => ['nullable', 'integer', 'min:1'],
            'user_id'      => ['nullable', 'integer', 'min:1'],
            'action'       => ['nullable', 'string', 'in:created,updated,deleted,other'],
            'from'         => ['nullable', 'date'],
            'to'           => ['nullable', 'date'],
            'tz_offset'    => ['nullable', 'integer', 'min:-840', 'max:840'],
            'q'            => ['nullable', 'string', 'max:100'],
            'page'         => ['nullable', 'integer', 'min:1'],
        ]);

        $query = ActivityLog::query()
            ->with('entries')
            ->orderByDesc('created_at')
            ->orderByDesc('id');

        // A record's history is every request that named it *or* touched it:
        // editing a post's blocks itemises PostBlock rows under a Post action.
        if (!empty($filters['subject_type'])) {
            $type = $filters['subject_type'];
            $id   = $filters['subject_id'] ?? null;
            $query->where(function (Builder $q) use ($type, $id) {
                $q->where(fn (Builder $own) => $this->matchSubject($own, $type, $id))
                  ->orWhereHas('entries', fn (Builder $c) => $this->matchSubject($c, $type, $id));
            });
        }

        if (!empty($filters['user_id'])) {
            $query->where('user_id', $filters['user_id']);
        }
        if (!empty($filters['action'])) {
            $query->where('action', $filters['action']);
        }
        // From/To are calendar days in the admin's own time zone — the table
        // shows times that way — while created_at is UTC. `tz_offset` is the
        // browser's getTimezoneOffset(): minutes to add to local time for UTC.
        $offset = (int) ($filters['tz_offset'] ?? 0);
        if (!empty($filters['from'])) {
            $query->where('created_at', '>=', Carbon::parse($filters['from'], 'UTC')->startOfDay()->addMinutes($offset));
        }
        if (!empty($filters['to'])) {
            // A bare date means "through the end of that day".
            $query->where('created_at', '<', Carbon::parse($filters['to'], 'UTC')->addDay()->startOfDay()->addMinutes($offset));
        }
        if (!empty($filters['q'])) {
            $like = '%'.addcslashes($filters['q'], '%_\\').'%';
            $query->where(function (Builder $q) use ($like) {
                $q->where('subject_label', 'like', $like)
                  ->orWhere('user_name', 'like', $like)
                  ->orWhereHas('entries', fn (Builder $c) => $c->where('subject_label', 'like', $like));
            });
        }

        $page = $query->paginate(self::PER_PAGE);

        return response()->json([
            'data' => collect($page->items())->map(fn (ActivityLog $log) => [
                'id'            => $log->id,
                'created_at'    => $log->created_at?->toIso8601String(),
                'user_id'       => $log->user_id,
                'user_name'     => $log->user_name,
                'action'        => $log->action,
                'method'        => $log->method,
                'route'         => $log->route,
                'subject_type'  => $log->subject_type,
                'subject_id'    => $log->subject_id,
                'subject_label' => $log->subject_label,
                'changes'       => $log->entries->map(fn (ActivityChange $c) => [
                    'id'            => $c->id,
                    'event'         => $c->event,
                    'subject_type'  => $c->subject_type,
                    'subject_id'    => $c->subject_id,
                    'subject_label' => $c->subject_label,
                    'diff'          => (object) ($c->diff ?? []),
                ])->values(),
            ])->values(),
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page'    => $page->lastPage(),
                'total'        => $page->total(),
                'per_page'     => $page->perPage(),
            ],
        ]);
    }

    /** What the filter dropdowns can offer: only values that actually occur. */
    public function filters(): JsonResponse
    {
        $types = ActivityLog::query()->whereNotNull('subject_type')->distinct()->pluck('subject_type')
            ->merge(ActivityChange::query()->distinct()->pluck('subject_type'))
            ->unique()->sort()->values();

        $users = ActivityLog::query()
            ->whereNotNull('user_id')
            ->selectRaw('user_id, MAX(user_name) as user_name')
            ->groupBy('user_id')
            ->orderBy('user_name')
            ->get()
            ->map(fn ($row) => ['id' => (int) $row->user_id, 'name' => $row->user_name]);

        return response()->json(['data' => ['subject_types' => $types, 'users' => $users]]);
    }

    private function matchSubject(Builder $q, string $type, ?int $id): Builder
    {
        $q->where('subject_type', $type);

        return $id !== null ? $q->where('subject_id', $id) : $q;
    }
}
