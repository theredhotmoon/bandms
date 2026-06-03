<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Instrument extends Model
{
    protected $fillable = ['name', 'category', 'stage_plot_type'];

    public function members(): BelongsToMany
    {
        return $this->belongsToMany(BandMember::class);
    }
}
