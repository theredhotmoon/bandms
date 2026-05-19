<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class NewsletterSubscriberResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'            => $this->id,
            'email'         => $this->email,
            'name'          => $this->name,
            'source'        => $this->source,
            'subscribed_at' => $this->subscribed_at?->toIso8601String(),
        ];
    }
}
