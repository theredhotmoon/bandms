<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

class BandProfileResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                      => $this->id,
            'name'                    => $this->name,
            'bio_short'               => $this->bio_short,
            'bio_medium'              => $this->bio_medium,
            'bio_long'                => $this->bio_long,
            'bio_full'                => $this->bio_full,
            'formation_year'          => $this->formation_year,
            'hometown'                => $this->hometown,
            'genres'                  => $this->genres,
            'comparable_artists'      => $this->comparable_artists,
            'booking_email'           => $this->booking_email,
            'press_email'             => $this->press_email,
            'tech_contact_phone'      => $this->tech_contact_phone,
            'tech_contact_email'      => $this->tech_contact_email,
            'tech_rider_notes'        => $this->tech_rider_notes,
            'career_level'            => (int) $this->career_level,
            'artistic_statement'      => $this->artistic_statement,
            'stat_spotify_monthly'    => $this->stat_spotify_monthly,
            'stat_instagram_followers'=> $this->stat_instagram_followers,
            'stat_tiktok_followers'   => $this->stat_tiktok_followers,
            'stat_youtube_subscribers'=> $this->stat_youtube_subscribers,
            'stat_facebook_followers'  => $this->stat_facebook_followers,
            'facebook_likes'           => $this->facebook_likes,
            'facebook_likes_synced_at' => $this->facebook_likes_synced_at?->toIso8601String(),
            'tech_rider_url'           => $this->tech_rider_path ? '/storage/' . $this->tech_rider_path : null,
            'stage_plot_url'          => $this->stage_plot_path ? '/storage/' . $this->stage_plot_path : null,
            'epk_release_id'          => $this->epk_release_id,
            'epk_album_id'            => $this->epk_album_id,
            'members'                 => BandMemberResource::collection($this->whenLoaded('members')),
            'social_links'            => SocialLinkResource::collection($this->whenLoaded('socialLinks')),
            'updated_at'              => $this->updated_at,
        ];
    }
}
