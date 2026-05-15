<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Str;

class PostSummaryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'           => $this->id,
            'title'        => $this->title,
            'slug'         => $this->slug,
            'excerpt'      => Str::limit($this->content ?? '', 280),
            'published_at' => $this->published_at,
            'categories'   => CategoryResource::collection($this->whenLoaded('categories')),
            'tags'         => TagResource::collection($this->whenLoaded('tags')),
            'created_at'   => $this->created_at,
            'updated_at'   => $this->updated_at,
        ];
    }
}
