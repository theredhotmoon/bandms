<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TechRiderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'           => $this->id,
            'profile_id'   => $this->profile_id,
            'name'         => $this->name,
            'is_active'    => $this->is_active,
            'public_token' => $this->public_token,
            'concert_id'   => $this->concert_id,
            'concert'      => $this->whenLoaded('concert', fn () => $this->concert ? [
                'id'    => $this->concert->id,
                'date'  => $this->concert->date,
                'venue' => $this->concert->venue?->name,
            ] : null),

            'gig_lineup' => [
                'regular_members' => $this->gig_lineup['regular_members'] ?? [],
                'temp_musicians'  => $this->gig_lineup['temp_musicians']  ?? [],
            ],

            // The rider's only technical source of truth.
            'placements' => $this->placements ?? [],

            // Every setup the placements reference, so the client resolves them
            // with the same code whether it is the admin editor, the preview, or
            // the unauthenticated public token view.
            'referenced_setups' => $this->referencedSetups()
                ->mapWithKeys(fn ($setup) => [
                    (string) $setup->id => (new BandMemberSetupResource($setup))->resolve($request),
                ]),

            'extra_inputs'   => $this->extra_inputs   ?? [],
            'extra_monitors' => $this->extra_monitors ?? [],
            'extra_backline' => $this->extra_backline ?? [],
            'extra_wireless' => $this->extra_wireless ?? [],
            'channel_order'  => $this->channel_order  ?? [],

            'power_notes' => [
                'total_wattage'     => $this->power_notes['total_wattage']     ?? null,
                'needs_clean_power' => (bool) ($this->power_notes['needs_clean_power'] ?? false),
                'general_notes'     => $this->power_notes['general_notes']     ?? '',
            ],

            'pa_foh' => [
                'room_coverage_notes'     => $this->pa_foh['room_coverage_notes']     ?? '',
                'subwoofer_notes'         => $this->pa_foh['subwoofer_notes']         ?? '',
                'processing_notes'        => $this->pa_foh['processing_notes']        ?? '',
                'console_preference'      => $this->pa_foh['console_preference']      ?? '',
                'brings_own_foh_engineer' => (bool) ($this->pa_foh['brings_own_foh_engineer'] ?? false),
                'foh_engineer_name'       => $this->pa_foh['foh_engineer_name']       ?? '',
                'brings_show_file'        => (bool) ($this->pa_foh['brings_show_file'] ?? false),
                'show_file_format'        => $this->pa_foh['show_file_format']        ?? '',
            ],

            /**
             * The frozen copy the public link currently serves, when there is
             * one. Loaded explicitly rather than always: a snapshot embeds this
             * same resource, and a version describing the version before it
             * inside a version would be noise at best.
             */
            'published_version' => $this->whenLoaded(
                'publishedVersion',
                fn () => $this->publishedVersion
                    ? (new TechRiderVersionResource($this->publishedVersion))->resolve($request)
                    : null,
            ),

            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
