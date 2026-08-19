<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * One musician's answer, with just enough of them to name in a list.
 *
 * Never `login_email`: this is read by the whole admin panel, and the address
 * belongs on the member record where BandMemberResource already gates it.
 */
class TechRiderConfirmationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'             => $this->id,
            'tech_rider_id'  => $this->tech_rider_id,
            'band_member_id' => $this->band_member_id,
            'member_name'    => $this->whenLoaded('bandMember', fn () => $this->bandMember
                ? ($this->bandMember->nickname ?: trim("{$this->bandMember->first_name} {$this->bandMember->last_name}"))
                : null),
            'requested_at'   => $this->requested_at,
            'confirmed_at'   => $this->confirmed_at,

            // Only for the "waiting on you" list a member sees.
            'rider' => $this->whenLoaded('techRider', fn () => [
                'id'      => $this->techRider->id,
                'name'    => $this->techRider->name,
                'concert' => $this->techRider->concert ? [
                    'date'  => $this->techRider->concert->date,
                    'venue' => $this->techRider->concert->venue?->name,
                ] : null,
            ]),
        ];
    }
}
