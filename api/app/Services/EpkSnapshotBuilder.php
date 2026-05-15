<?php

namespace App\Services;

use App\Models\BandProfile;
use App\Models\Concert;
use App\Models\Photo;
use App\Models\PressRelease;

class EpkSnapshotBuilder
{
    public static function build(): array
    {
        $profile = BandProfile::findOrFail(1)->load([
            'socialLinks',
            'musicVideos',
            'epkRelease.links',
            'epkRelease.tracks.links',
        ]);

        $pressPhotos = Photo::where('epk_featured', true)
            ->orderBy('sort_order')
            ->get();

        $pressArticles = PressRelease::with('tags')
            ->where('featured', true)
            ->orderByDesc('published_at')
            ->limit(3)
            ->get();

        $upcomingConcerts = Concert::with(['venue', 'links'])
            ->where('date', '>=', now()->toDateString())
            ->orderBy('date')
            ->limit(5)
            ->get();

        $release = $profile->epkRelease;

        return [
            'name'                     => $profile->name,
            'bio_short'                => $profile->bio_short,
            'bio_medium'               => $profile->bio_medium,
            'bio_long'                 => $profile->bio_long,
            'formation_year'           => $profile->formation_year,
            'hometown'                 => $profile->hometown,
            'genres'                   => $profile->genres,
            'comparable_artists'       => $profile->comparable_artists,
            'booking_email'            => $profile->booking_email,
            'press_email'              => $profile->press_email,
            'stat_spotify_monthly'     => $profile->stat_spotify_monthly,
            'stat_instagram_followers' => $profile->stat_instagram_followers,
            'stat_tiktok_followers'    => $profile->stat_tiktok_followers,
            'stat_youtube_subscribers' => $profile->stat_youtube_subscribers,
            'stat_facebook_followers'  => $profile->stat_facebook_followers,
            'tech_rider_url'           => $profile->tech_rider_path ? '/storage/' . $profile->tech_rider_path : null,
            'stage_plot_url'           => $profile->stage_plot_path ? '/storage/' . $profile->stage_plot_path : null,
            'social_links'             => $profile->socialLinks->map(fn ($l) => [
                'platform' => $l->platform,
                'url'      => $l->url,
                'label'    => $l->label,
            ])->values()->all(),
            'music_videos' => $profile->musicVideos->map(fn ($v) => [
                'id'           => $v->id,
                'title'        => $v->title,
                'video_url'    => $v->video_url,
                'published_at' => $v->published_at?->format('Y-m-d'),
            ])->values()->all(),
            'featured_release' => $release ? [
                'id'           => $release->id,
                'title'        => $release->title,
                'type'         => $release->type,
                'release_date' => $release->release_date?->format('Y-m-d'),
                'cover_image'  => $release->cover_image ? '/storage/' . $release->cover_image : null,
                'description'  => $release->description,
                'links'        => $release->links->map(fn ($l) => ['platform' => $l->platform, 'url' => $l->url])->values()->all(),
                'tracks'       => $release->tracks->map(fn ($t) => [
                    'id'         => $t->id,
                    'title'      => $t->title,
                    'duration'   => $t->duration,
                    'sort_order' => $t->sort_order,
                    'links'      => $t->links->map(fn ($l) => ['platform' => $l->platform, 'url' => $l->url])->values()->all(),
                ])->values()->all(),
            ] : null,
            'press_photos' => $pressPhotos->map(fn ($p) => [
                'id'        => $p->id,
                'image_url' => $p->image ? '/storage/' . $p->image : null,
                'caption'   => $p->caption,
            ])->values()->all(),
            'press_articles'    => $pressArticles->map(fn ($pr) => [
                'id'             => $pr->id,
                'url'            => $pr->url,
                'og_title'       => $pr->og_title,
                'og_description' => $pr->og_description,
                'og_image'       => $pr->og_image,
                'og_site_name'   => $pr->og_site_name,
                'published_at'   => $pr->published_at?->toIso8601String(),
                'tags'           => $pr->tags->map(fn ($t) => ['id' => $t->id, 'name' => $t->name])->values()->all(),
            ])->values()->all(),
            'upcoming_concerts' => $upcomingConcerts->map(fn ($c) => [
                'id'         => $c->id,
                'date'       => $c->date?->format('Y-m-d'),
                'start_time' => $c->start_time,
                'venue'      => $c->venue ? ['name' => $c->venue->name, 'city' => $c->venue->city, 'country' => $c->venue->country] : null,
                'links'      => $c->links->map(fn ($l) => ['label' => $l->label, 'url' => $l->url])->values()->all(),
            ])->values()->all(),
        ];
    }
}
