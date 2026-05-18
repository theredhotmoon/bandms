<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BandProfile extends Model
{
    protected $fillable = [
        'name', 'bio_short', 'bio_medium', 'bio_long', 'bio_full',
        'formation_year', 'hometown', 'genres', 'comparable_artists',
        'booking_email', 'press_email', 'artistic_statement',
        'tech_contact_phone', 'tech_contact_email', 'tech_rider_notes', 'career_level',
        'stat_spotify_monthly', 'stat_instagram_followers', 'stat_tiktok_followers',
        'stat_youtube_subscribers', 'stat_facebook_followers',
        'facebook_likes', 'facebook_likes_synced_at',
        'tech_rider_path', 'stage_plot_path',
        'epk_release_id', 'epk_album_id',
    ];

    protected $casts = [
        'facebook_likes'          => 'integer',
        'facebook_likes_synced_at' => 'datetime',
    ];

    public function members(): HasMany
    {
        return $this->hasMany(BandMember::class, 'profile_id');
    }

    public function releases(): HasMany
    {
        return $this->hasMany(Release::class, 'profile_id');
    }

    public function socialLinks(): HasMany
    {
        return $this->hasMany(SocialLink::class, 'profile_id')->whereNull('member_id');
    }

    public function testimonials(): HasMany
    {
        return $this->hasMany(Testimonial::class, 'profile_id')->orderBy('sort_order')->orderBy('id');
    }

    public function musicVideos(): HasMany
    {
        return $this->hasMany(MusicVideo::class, 'profile_id')->orderBy('sort_order')->orderBy('id');
    }

    public function epkRelease(): BelongsTo
    {
        return $this->belongsTo(Release::class, 'epk_release_id');
    }

    public function epkAlbum(): BelongsTo
    {
        return $this->belongsTo(Album::class, 'epk_album_id');
    }
}
