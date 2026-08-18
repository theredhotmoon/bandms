<?php

declare(strict_types=1);

namespace App\Services;

use App\Http\Resources\TechRiderResource;
use App\Models\BandMember;
use App\Models\BandProfile;
use App\Models\TechRider;
use Illuminate\Http\Request;

/**
 * Freezes everything a rider needs to render, and nothing it does not.
 *
 * The deliberate choice here is that a snapshot stores the *inputs* to
 * resolution — the rider, the saved rigs its placements reference, the
 * musicians' names and instruments — rather than the resolved channel list.
 *
 * Resolving lives in one place, app/src/utils/riderResolver.ts, and every
 * surface calls it: the admin editor, the preview, and the public page. A PHP
 * copy that flattened the lists here would be a second implementation of the
 * same rules, which is precisely the drift the placements refactor removed.
 * The resolver is pure, so freezing its inputs freezes its output just as
 * effectively — and a resolver bugfix still reaches old versions, which is what
 * you want from a rendering change and never wanted from a data change.
 *
 * Only the members a placement actually references are frozen. A snapshot is
 * a public document: it carries display identity (name, role, photo,
 * instruments) and never the admin-only fields BandMemberResource exposes to
 * authenticated staff.
 */
class TechRiderSnapshotBuilder
{
    public const FORMAT = 1;

    public static function build(TechRider $rider, Request $request): array
    {
        $rider->loadMissing('concert.venue');

        return [
            // Lets a future shape change be detected rather than guessed at.
            'format'     => self::FORMAT,
            'taken_at'   => now()->toIso8601String(),
            'rider'      => (new TechRiderResource($rider))->resolve($request),
            'members'    => self::members($rider),
            'profile'    => self::profile(),
        ];
    }

    /**
     * The musicians this rider places, with only what the printed sheet shows.
     *
     * @return array<int, array<string, mixed>>
     */
    private static function members(TechRider $rider): array
    {
        $ids = collect($rider->placements ?? [])
            ->pluck('band_member_id')
            ->filter(fn ($id) => is_int($id) || ctype_digit((string) $id))
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        if ($ids->isEmpty()) {
            return [];
        }

        return BandMember::with(['mainInstrument', 'instruments'])
            ->whereIn('id', $ids)
            ->get()
            ->map(fn (BandMember $m) => [
                'id'         => $m->id,
                'first_name' => $m->first_name,
                'last_name'  => $m->last_name,
                'nickname'   => $m->nickname,
                'role'       => $m->role,
                // Same host-stripping as BandMemberResource, so a snapshot taken
                // behind one hostname still renders behind another.
                'photo'      => $m->photo ? preg_replace('#^https?://[^/]+#', '', $m->photo) : null,
                'is_current' => (bool) $m->is_current,
                'main_instrument_id' => $m->main_instrument_id,
                'main_instrument'    => $m->mainInstrument ? self::instrument($m->mainInstrument) : null,
                'instruments'        => $m->instruments->map(fn ($i) => self::instrument($i))->values()->all(),
            ])
            ->values()
            ->all();
    }

    /** @return array<string, mixed> */
    private static function instrument(object $instrument): array
    {
        return [
            'id'              => $instrument->id,
            'name'            => $instrument->name,
            'category'        => $instrument->category,
            'stage_plot_type' => $instrument->stage_plot_type,
        ];
    }

    /**
     * Band identity as it appeared on the sheet. Only the logo and the name are
     * printed, so only those are frozen — a later rebrand does not rewrite a
     * rider the venue already has.
     *
     * @return array<string, mixed>
     */
    private static function profile(): array
    {
        $profile = BandProfile::with(['techRiderLogo', 'defaultLogo'])->first();

        return [
            'name'     => $profile?->name,
            'logo_url' => $profile?->techRiderLogo?->url ?? $profile?->defaultLogo?->url,
        ];
    }
}
