<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SetlistItemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                    => $this->id,
            'setlist_id'            => $this->setlist_id,
            'song_id'               => $this->song_id,
            'song'                  => new SongResource($this->whenLoaded('song')),
            'position'              => $this->position,
            'is_encore'             => $this->is_encore,
            'transition'            => $this->transition,
            'lighting_cue'          => $this->lighting_cue ?? '',
            'sound_note'            => $this->sound_note ?? '',
            'member_notes'          => $this->member_notes ?? [],
            'override_duration_sec' => $this->override_duration_sec,
        ];
    }
}
