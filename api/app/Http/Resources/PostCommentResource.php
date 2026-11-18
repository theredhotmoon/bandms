<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A comment as the public sees it. No email, no fan id: the author is the
 * display name they chose, and `mine` is all the page needs to offer Delete.
 */
class PostCommentResource extends JsonResource
{
    /** The signed-in fan's id, when the request carried a valid session. */
    private ?int $viewerId = null;

    public function forViewer(?int $fanId): static
    {
        $this->viewerId = $fanId;

        return $this;
    }

    public function toArray(Request $request): array
    {
        return [
            'id'          => $this->id,
            'author_name' => (string) $this->fan?->display_name,
            'body'        => $this->body,
            'created_at'  => $this->created_at,
            'mine'        => $this->viewerId !== null && $this->fan_account_id === $this->viewerId,
        ];
    }
}
