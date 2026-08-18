<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A version's metadata — never its snapshot.
 *
 * Snapshots are large (the whole rider plus every rig it references), and the
 * admin only ever lists them; the snapshot itself is served by the public token
 * endpoint, one version at a time.
 */
class TechRiderVersionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'             => $this->id,
            'tech_rider_id'  => $this->tech_rider_id,
            'version_number' => $this->version_number,
            'notes'          => $this->notes,
            'status'         => $this->status,
            'public_token'   => $this->public_token,
            'published_at'   => $this->published_at,
            'created_at'     => $this->created_at,
        ];
    }
}
