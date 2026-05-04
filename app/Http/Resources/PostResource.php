<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PostResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'           => $this->id,
            'title'        => $this->title,
            'slug'         => $this->slug,
            'content'      => $this->content,
            'image'        => $this->image,
            'published_at' => $this->published_at,
            'categories'   => CategoryResource::collection($this->whenLoaded('categories')),
            'tags'         => TagResource::collection($this->whenLoaded('tags')),
            'links'        => PostLinkResource::collection($this->whenLoaded('links')),
            'created_at'   => $this->created_at,
            'updated_at'   => $this->updated_at,
        ];
    }
}
