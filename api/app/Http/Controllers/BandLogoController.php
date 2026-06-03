<?php

namespace App\Http\Controllers;

use App\Http\Resources\BandLogoResource;
use App\Models\BandLogo;
use App\Models\BandProfile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class BandLogoController extends Controller
{
    private function profile(): BandProfile
    {
        return BandProfile::findOrFail(1);
    }

    // ── GET /api/band-profile/logos ───────────────────────────────────────────
    // Admin: returns ALL logos including deprecated.
    // Public callers use the logo data embedded in GET /api/band-profile.

    public function index(): AnonymousResourceCollection
    {
        $logos = BandLogo::where('profile_id', $this->profile()->id)
            ->orderBy('sort_order')
            ->orderBy('created_at', 'desc')
            ->get();

        return BandLogoResource::collection($logos);
    }

    // ── POST /api/band-profile/logos ──────────────────────────────────────────

    public function store(Request $request): BandLogoResource
    {
        $request->validate([
            'file'          => ['required', 'file', 'mimes:png,jpg,jpeg,webp,svg', 'max:4096'],
            'label'         => ['nullable', 'string', 'max:255'],
            'variant'       => ['nullable', 'string', 'in:full,icon,horizontal,stacked,wordmark'],
            'background'    => ['nullable', 'string', 'in:light,dark,transparent,any'],
            'version_label' => ['nullable', 'string', 'max:100'],
            'notes'         => ['nullable', 'string'],
        ]);

        $file     = $request->file('file');
        $path     = $file->store('logos', 'public');
        $mime     = $file->getMimeType() ?? 'image/png';
        $size     = $file->getSize();

        // Detect pixel dimensions for raster images
        [$width, $height] = $this->detectDimensions($file->getRealPath(), $mime);

        $profile = $this->profile();
        $isFirst = !BandLogo::where('profile_id', $profile->id)->exists();

        $logo = BandLogo::create([
            'profile_id'    => $profile->id,
            'file_path'     => $path,
            'original_name' => $file->getClientOriginalName(),
            'mime_type'     => $mime,
            'file_size'     => $size ?: null,
            'width'         => $width,
            'height'        => $height,
            'label'         => $request->input('label'),
            'variant'       => $request->input('variant', 'full'),
            'background'    => $request->input('background', 'any'),
            'version_label' => $request->input('version_label'),
            'notes'         => $request->input('notes'),
            'is_default'    => $isFirst,  // first upload auto-becomes default
            'sort_order'    => 0,
        ]);

        return new BandLogoResource($logo);
    }

    // ── PUT /api/band-profile/logos/{logo} ────────────────────────────────────

    public function update(Request $request, BandLogo $logo): BandLogoResource
    {
        abort_unless($logo->profile_id === $this->profile()->id, 403);

        $data = $request->validate([
            'label'         => ['nullable', 'string', 'max:255'],
            'variant'       => ['nullable', 'string', 'in:full,icon,horizontal,stacked,wordmark'],
            'background'    => ['nullable', 'string', 'in:light,dark,transparent,any'],
            'version_label' => ['nullable', 'string', 'max:100'],
            'notes'         => ['nullable', 'string'],
            'is_deprecated' => ['boolean'],
            'sort_order'    => ['integer', 'min:0'],
        ]);

        // Cannot un-deprecate a logo that is the default
        if (($data['is_deprecated'] ?? false) && $logo->is_default) {
            abort(422, 'Cannot deprecate the current default logo. Set another logo as default first.');
        }

        $logo->update($data);

        return new BandLogoResource($logo->fresh());
    }

    // ── POST /api/band-profile/logos/{logo}/set-default ──────────────────────

    public function setDefault(BandLogo $logo): BandLogoResource
    {
        abort_unless($logo->profile_id === $this->profile()->id, 403);
        abort_if($logo->is_deprecated, 422, 'Cannot set a deprecated logo as default.');

        DB::transaction(function () use ($logo) {
            BandLogo::where('profile_id', $logo->profile_id)
                ->update(['is_default' => false]);
            $logo->update(['is_default' => true]);
        });

        return new BandLogoResource($logo->fresh());
    }

    // ── DELETE /api/band-profile/logos/{logo} ─────────────────────────────────

    public function destroy(BandLogo $logo): JsonResponse
    {
        abort_unless($logo->profile_id === $this->profile()->id, 403);

        if ($logo->is_default) {
            $hasOther = BandLogo::where('profile_id', $logo->profile_id)
                ->where('id', '!=', $logo->id)
                ->where('is_deprecated', false)
                ->exists();
            abort_if($hasOther, 422, 'Set another logo as the default before deleting this one.');
        }

        Storage::disk('public')->delete($logo->file_path);
        $logo->delete();

        return response()->json(null, 204);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** Returns [width, height] or [null, null] for SVG/unknown. */
    private function detectDimensions(string $realPath, string $mime): array
    {
        if ($mime === 'image/svg+xml') {
            return [null, null];
        }
        $info = @getimagesize($realPath);
        return $info ? [$info[0], $info[1]] : [null, null];
    }
}
