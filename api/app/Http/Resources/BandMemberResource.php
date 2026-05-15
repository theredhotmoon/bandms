<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BandMemberResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'         => $this->id,
            'band_id'    => $this->band_id,
            'first_name' => $this->first_name,
            'last_name'  => $this->last_name,
            'bio'        => $this->bio,
            'photo'      => $this->photo,
            'role'       => $this->role,
            'is_current' => $this->is_current,
            'joined_at'  => $this->joined_at?->format('Y-m-d'),
            'quit_at'    => $this->quit_at?->format('Y-m-d'),
            'sort_order'   => $this->sort_order,
            'calendar_url' => $this->calendar_url,
            'login_email'  => $this->when($request->user()?->isAdmin(), $this->login_email),
            'can_login'    => $this->can_login,
            'instruments'  => $this->instruments->map(fn ($i) => [
                'id'       => $i->id,
                'name'     => $i->name,
                'category' => $i->category,
            ]),
            'social_links' => $this->socialLinks->map(fn ($l) => [
                'id'       => $l->id,
                'platform' => $l->platform,
                'url'      => $l->url,
            ]),
            // Setup summaries — loaded when setups relation is eager-loaded
            'setup_summaries' => $this->whenLoaded('setups', fn () =>
                $this->setups->map(fn ($s) => [
                    'id'                => $s->id,
                    'name'              => $s->name,
                    'instrument_id'     => $s->instrument_id,
                    'signal_chain_type' => $s->signal_chain_type,
                    'input_count'       => count($s->inputs ?? []),
                    'updated_at'        => $s->updated_at,
                ])
            ),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
