<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphToMany;
use Illuminate\Support\Str;

class BandMember extends Model
{
    use HasFactory;

    protected $fillable = [
        'profile_id',
        'first_name',
        'nickname',
        'last_name',
        'slug',
        'bio',
        'photo',
        'role',
        'is_current',
        'joined_at',
        'quit_at',
        'sort_order',
        'calendar_url',
        'login_email',
        'can_login',
        'default_gear',
        'main_instrument_id',
    ];

    protected $casts = [
        'is_current'   => 'boolean',
        'can_login'    => 'boolean',
        'joined_at'    => 'date:Y-m-d',
        'quit_at'      => 'date:Y-m-d',
        'sort_order'   => 'integer',
        'default_gear' => 'array',
    ];

    /**
     * The slug is the member's public URL, and that URL is printed as a QR
     * code — so it is generated once, on create, and never follows a rename.
     */
    protected static function booted(): void
    {
        static::creating(function (BandMember $member) {
            if (blank($member->slug)) {
                $member->slug = static::uniqueSlug(trim("{$member->first_name} {$member->last_name}"));
            }
        });
    }

    public static function uniqueSlug(string $name): string
    {
        $base = Str::slug($name) ?: 'member';
        $slug = $base;
        for ($n = 2; static::where('slug', $slug)->exists(); $n++) {
            $slug = "{$base}-{$n}";
        }

        return $slug;
    }

    /** Photos this member is tagged in (many members can share one photo). */
    public function photos(): MorphToMany
    {
        return $this->morphedByMany(Photo::class, 'memberable');
    }

    /** News this member is linked to (a post can be about several members). */
    public function posts(): MorphToMany
    {
        return $this->morphedByMany(Post::class, 'memberable');
    }

    /** Concerts this member played (line-ups change, so links are explicit). */
    public function concerts(): MorphToMany
    {
        return $this->morphedByMany(Concert::class, 'memberable');
    }

    /** Clips this member appears in. */
    public function clips(): MorphToMany
    {
        return $this->morphedByMany(Clip::class, 'memberable');
    }

    /** Releases this member played on. */
    public function releases(): MorphToMany
    {
        return $this->morphedByMany(Release::class, 'memberable');
    }

    /** Music videos this member appears in. */
    public function musicVideos(): MorphToMany
    {
        return $this->morphedByMany(MusicVideo::class, 'memberable');
    }

    public function profile(): BelongsTo
    {
        return $this->belongsTo(BandProfile::class, 'profile_id');
    }

    public function socialLinks(): HasMany
    {
        return $this->hasMany(SocialLink::class, 'member_id')->orderBy('position');
    }

    public function mainInstrument(): BelongsTo
    {
        return $this->belongsTo(Instrument::class, 'main_instrument_id');
    }

    public function instruments(): BelongsToMany
    {
        return $this->belongsToMany(Instrument::class);
    }

    public function setups(): HasMany
    {
        return $this->hasMany(BandMemberSetup::class);
    }
}
