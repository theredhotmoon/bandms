<?php

namespace App\Support\Activity;

use App\Models\ActivityChange;
use App\Models\ActivityLog;
use App\Models\AllowedEmail;
use App\Models\AssistantFinding;
use App\Models\AssistantRun;
use App\Models\FanAccount;
use App\Models\NewsletterSubscriber;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\SiteDirtyArea;
use App\Models\Ticket;
use App\Models\TicketTransfer;
use App\Models\User;
use App\Support\Locales;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Throwable;

/**
 * Writes the activity log. Bound as a *scoped* singleton: one instance per
 * HTTP request or queued job, so everything one request changes lands under
 * one ActivityLog row.
 *
 * The diff is taken when the model event fires (the model moves on after),
 * but the rows are written through DB::afterCommit(): never inside the
 * caller's transaction. A rolled-back or retried transaction drops its
 * pending rows, so a change that never happened is never logged, and the
 * log's INSERTs cannot widen a lock window or become a deadlock victim that
 * takes the business write down with it.
 *
 * See docs/superpowers/specs/2026-10-30-activity-log-design.md.
 */
class ActivityRecorder
{
    /** Models whose writes are never itemised. */
    private const IGNORED = [
        ActivityLog::class,
        ActivityChange::class,
        // Rebuild bookkeeping, written by nearly every admin save.
        SiteDirtyArea::class,
        // The nightly crawler's output: hundreds of rows a night written by
        // a job, not by the band. Its settings are edited by people and stay.
        AssistantFinding::class,
        AssistantRun::class,
    ];

    /** Passport writes a token on every sign-in; that is not band activity. */
    private const IGNORED_PREFIXES = ['Laravel\\Passport\\'];

    /**
     * Records about people who are not users of the admin — subscribers,
     * fans, buyers, ticket holders. Their changes are logged by field name
     * only: a value copied into the log would outlive the person's own row
     * when they unsubscribe or ask to be erased.
     */
    private const PERSONAL = [
        NewsletterSubscriber::class,
        FanAccount::class,
        Order::class,
        OrderItem::class,
        Ticket::class,
        TicketTransfer::class,
        AllowedEmail::class,
    ];

    /**
     * Never stored, whatever the model's $hidden says. A pattern, not a list
     * of names, so a column added later (`password_hash`, a bare `token`) is
     * redacted without anyone remembering to come back here. `ticket_code`
     * is a door pass: holding it gets you in.
     */
    private const REDACTED = '/password|secret|token|api_?key|private_?key|credential|ticket_code/i';

    private const MASK = '***';

    private const TIMESTAMPS = ['created_at', 'updated_at'];

    private const MAX_VALUE_LENGTH = 2000;

    /** Attributes tried, in order, for a human-readable label. */
    private const LABEL_ATTRIBUTES = ['title', 'name', 'label', 'question', 'code', 'email', 'order_number', 'slug'];

    private ?int $logId = null;

    /** Set by the RecordActivity middleware for the length of a request. */
    private ?Request $request = null;

    /**
     * Start a request's log. Resets the current row too: the container is not
     * rebuilt between two requests in one test, so a scoped instance alone
     * would file the second request's changes under the first.
     */
    public function forRequest(Request $request): void
    {
        $this->request = $request;
        $this->logId   = null;
    }

    /** Called from the global `eloquent.{created,updated,deleted}: *` listener. */
    public function record(string $event, Model $model): void
    {
        if ($this->ignores($model) || $this->isVisitor()) {
            return;
        }

        $diff = $this->diff($event, $model);
        if ($diff === null) {
            return;
        }

        $this->write([
            'event'         => $event,
            'subject_type'  => class_basename($model),
            'subject_id'    => $model->getKey(),
            'subject_label' => self::labelFor($model),
            'diff'          => $diff,
        ]);
    }

    /**
     * Log a change the model events cannot see — a relation rewritten through
     * the query builder (PostBlockSync's delete-and-insert). Filed as an
     * `updated` on $subject, so it reads as part of that record's history.
     *
     * Two lists are compared item by item and only the positions that differ
     * are kept (`blocks.2`), so fixing a typo in one paragraph of a long
     * article stores that paragraph, not the article twice. An absent key and
     * a null one say the same thing ({en: 'x'} vs {en: 'x', pl: null}).
     */
    public function recordField(Model $subject, string $field, mixed $before, mixed $after): void
    {
        if ($this->isVisitor()) {
            return;
        }

        $before = self::withoutNulls($before);
        $after  = self::withoutNulls($after);

        $diff = [];
        if (is_array($before) && is_array($after) && array_is_list($before) && array_is_list($after)) {
            $count = max(count($before), count($after));
            for ($i = 0; $i < $count; $i++) {
                $old = $before[$i] ?? null;
                $new = $after[$i] ?? null;
                if ($old != $new) {
                    $diff["{$field}.{$i}"] = [self::normalise($old), self::normalise($new)];
                }
            }
        } elseif ($before != $after) {
            $diff[$field] = [self::normalise($before), self::normalise($after)];
        }

        if ($diff === []) {
            return;
        }

        $this->write([
            'event'         => 'updated',
            'subject_type'  => class_basename($subject),
            'subject_id'    => $subject->getKey(),
            'subject_label' => self::labelFor($subject),
            'diff'          => $diff,
        ]);
    }

    /**
     * End of a successful mutating request, after every transaction has
     * committed. Fills in what only the request knows — the route and the
     * record it named. An authenticated write that itemised nothing (a pivot
     * sync, a query-builder delete) still gets a row, but only when the
     * route names a record: a logout or an image upload is not an edit.
     */
    public function finishRequest(Request $request): void
    {
        $route   = $request->route();
        $subject = null;
        foreach ($route?->parameters() ?? [] as $param) {
            if ($param instanceof Model) {
                $subject = $param;
                break;
            }
        }

        if ($this->logId === null && ($subject === null || $this->user() === null)) {
            return;
        }

        try {
            $log = ActivityLog::find($this->logId());
            if ($log === null) {
                return;
            }

            $first = $log->entries()->first();
            $subjectFields = $subject !== null
                ? ['subject_type' => class_basename($subject), 'subject_id' => $subject->getKey(), 'subject_label' => self::labelFor($subject)]
                : ($first ? ['subject_type' => $first->subject_type, 'subject_id' => $first->subject_id, 'subject_label' => $first->subject_label] : []);

            $log->update([
                ...$subjectFields,
                'action' => self::actionFor($route?->getName(), $request->method(), $first?->event),
            ]);
        } catch (Throwable $e) {
            report($e);
        }
    }

    /** Insert one change once the surrounding transaction (if any) commits. */
    private function write(array $row): void
    {
        DB::afterCommit(function () use ($row) {
            try {
                ActivityChange::create([...$row, 'activity_log_id' => $this->logId()]);
            } catch (Throwable $e) {
                // The log must never be why a save fails.
                report($e);
            }
        });
    }

    /**
     * An anonymous web request — a visitor subscribing, buying, checking out.
     * Not logged: the log is the band's record of its own edits, and a
     * visitor's details have no business outliving their own rows. Jobs and
     * commands (no request) are logged as the system.
     */
    private function isVisitor(): bool
    {
        $http = $this->request !== null || !app()->runningInConsole();

        return $http && $this->user() === null;
    }

    private static function labelFor(Model $model): ?string
    {
        return in_array($model::class, self::PERSONAL, true) ? null : self::label($model);
    }

    // ── Internals ────────────────────────────────────────────────────────────

    private function ignores(Model $model): bool
    {
        $class = $model::class;
        if (in_array($class, self::IGNORED, true)) {
            return true;
        }
        foreach (self::IGNORED_PREFIXES as $prefix) {
            if (str_starts_with($class, $prefix)) {
                return true;
            }
        }

        return false;
    }

    /** @return array<string, array{0: mixed, 1: mixed}>|null  null = nothing worth recording */
    private function diff(string $event, Model $model): ?array
    {
        $hidden = $model->getHidden();
        $after  = $model->getAttributes();

        $keys = match ($event) {
            'updated' => array_keys($model->getChanges()),
            default   => array_keys(array_filter($after, fn ($v) => $v !== null)),
        };
        $keys = array_values(array_diff($keys, self::TIMESTAMPS));

        if ($keys === []) {
            // A created/deleted row is always worth a line, even if empty.
            return $event === 'updated' ? null : [];
        }

        $personal = in_array($model::class, self::PERSONAL, true);

        $diff = [];
        foreach ($keys as $key) {
            if ($personal || $this->isRedacted($key, $hidden)) {
                $diff[$key] = [self::MASK, self::MASK];
                continue;
            }

            $old = $event === 'created' ? null : $model->getRawOriginal($key);
            $new = $event === 'deleted' ? null : ($after[$key] ?? null);
            if ($event === 'deleted') {
                $old = $after[$key] ?? $old;
            }

            $diff[$key] = [self::normalise($old), self::normalise($new)];
        }

        return $diff;
    }

    /** @param array<int, string> $hidden */
    private function isRedacted(string $key, array $hidden): bool
    {
        return in_array($key, $hidden, true) || preg_match(self::REDACTED, $key) === 1;
    }

    /** JSON columns are decoded (translation bags read per locale); long text is cut. */
    private static function normalise(mixed $value): mixed
    {
        if (is_string($value)) {
            $trimmed = ltrim($value);
            if ($trimmed !== '' && ($trimmed[0] === '{' || $trimmed[0] === '[')) {
                $decoded = json_decode($value, true);
                if (json_last_error() === JSON_ERROR_NONE) {
                    return self::normalise($decoded);
                }
            }

            return Str::limit($value, self::MAX_VALUE_LENGTH, '…');
        }

        if (is_array($value)) {
            // A JSON bag can carry a secret under its own key, too.
            $out = [];
            foreach ($value as $k => $v) {
                $out[$k] = is_string($k) && preg_match(self::REDACTED, $k) === 1 ? self::MASK : self::normalise($v);
            }

            return $out;
        }

        return $value;
    }

    private static function withoutNulls(mixed $value): mixed
    {
        if (!is_array($value)) {
            return $value;
        }

        $out = [];
        foreach ($value as $k => $v) {
            if ($v !== null) {
                $out[$k] = self::withoutNulls($v);
            }
        }

        return $out;
    }

    private function logId(): int
    {
        if ($this->logId !== null) {
            return $this->logId;
        }

        $user    = $this->user();
        $request = $this->request ?? (app()->runningInConsole() ? null : request());

        $log = ActivityLog::create([
            'user_id'    => $user?->id,
            'user_name'  => $user ? trim("{$user->first_name} {$user->last_name}") : null,
            'action'     => 'other',
            'method'     => $request?->method(),
            'route'      => $request?->route()?->getName(),
            'ip'         => $request?->ip(),
            'created_at' => now(),
        ]);

        return $this->logId = $log->id;
    }

    private function user(): ?User
    {
        try {
            $user = Auth::guard('api')->user();
        } catch (Throwable) {
            return null;
        }

        return $user instanceof User ? $user : null;
    }

    /** A short, human name for a record — a snapshot, so a deleted one still reads as something. */
    public static function label(Model $model): ?string
    {
        $attributes = $model->getAttributes();

        if (isset($attributes['first_name']) || isset($attributes['last_name'])) {
            return Str::limit(trim(($attributes['first_name'] ?? '').' '.($attributes['last_name'] ?? '')), 190, '…');
        }

        foreach (self::LABEL_ATTRIBUTES as $key) {
            if (!array_key_exists($key, $attributes) || $attributes[$key] === null || $attributes[$key] === '') {
                continue;
            }

            $value = $attributes[$key];
            if (method_exists($model, 'isTranslatableAttribute') && $model->isTranslatableAttribute($key)) {
                $bag   = is_array($value) ? $value : (json_decode((string) $value, true) ?: []);
                $value = Locales::resolve($bag, Locales::default());
            }

            if (is_scalar($value) && (string) $value !== '') {
                return Str::limit((string) $value, 190, '…');
            }
        }

        return null;
    }

    /**
     * created / updated / deleted / other. The route name's last segment is the
     * best evidence (`api.posts.destroy`), then the first itemised change, then
     * the HTTP verb.
     */
    public static function actionFor(?string $routeName, ?string $method, ?string $firstEvent): string
    {
        $verb = $routeName ? Str::afterLast($routeName, '.') : null;

        return match (true) {
            $verb === 'store'   => 'created',
            $verb === 'update'  => 'updated',
            $verb === 'destroy' => 'deleted',
            $firstEvent !== null => $firstEvent,
            $method === 'POST'   => 'created',
            in_array($method, ['PUT', 'PATCH'], true) => 'updated',
            $method === 'DELETE' => 'deleted',
            default => 'other',
        };
    }
}
