<?php

namespace App\Models;

use App\Support\ClipOwners;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphToMany;
use Spatie\Translatable\HasTranslations;

class Clip extends Model
{
    use HasFactory, HasTranslations;

    public array $translatable = ['title'];

    protected $fillable = ['provider', 'url', 'title', 'category', 'recorded_on', 'show_in_epk'];

    protected function casts(): array
    {
        return [
            'recorded_on' => 'date:Y-m-d',
            'show_in_epk' => 'boolean',
        ];
    }

    public function concerts(): MorphToMany
    {
        return $this->owners(Concert::class);
    }

    public function releases(): MorphToMany
    {
        return $this->owners(Release::class);
    }

    public function shopItems(): MorphToMany
    {
        return $this->owners(ShopItem::class);
    }

    public function albums(): MorphToMany
    {
        return $this->owners(Album::class);
    }

    /** The relation for a morph alias — `concerts()` for 'concert', etc. */
    public function ownerRelation(string $alias): MorphToMany
    {
        return $this->owners(ClipOwners::MAP[$alias]);
    }

    private function owners(string $class): MorphToMany
    {
        return $this->morphedByMany($class, 'clippable')->withPivot('position');
    }

    /**
     * Every owner, flattened for the resource: {type, id, label, slug_en?, date?}.
     * Relies on the four owner relations being eager-loaded by the caller.
     *
     * @return array<int, array<string, mixed>>
     */
    public function ownersList(): array
    {
        $out = [];

        foreach ($this->concerts as $c) {
            $out[] = ['type' => 'concert', 'id' => $c->id, 'slug_en' => $c->slug_en, 'date' => $c->date?->format('Y-m-d'),
                      'label' => trim(($c->date?->format('Y-m-d') ?? '') . ' — ' . ($c->venue?->name ?? $c->getTranslation('name', 'en') ?? ''), ' —')];
        }
        foreach ($this->releases as $r) {
            $out[] = ['type' => 'release', 'id' => $r->id, 'label' => $r->title];
        }
        foreach ($this->shopItems as $s) {
            $out[] = ['type' => 'shop_item', 'id' => $s->id, 'slug_en' => $s->slug_en, 'label' => $s->name];
        }
        foreach ($this->albums as $a) {
            $out[] = ['type' => 'album', 'id' => $a->id, 'label' => $a->title];
        }

        return $out;
    }
}
