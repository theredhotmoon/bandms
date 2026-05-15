<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SocialLinkResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'        => $this->id,
            'band_id'   => $this->band_id,
            'member_id' => $this->member_id,
            'platform'  => $this->platform,
            'url'       => $this->url,
        ];
    }
}
