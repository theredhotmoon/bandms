<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One Eloquent write inside an ActivityLog: `diff` is `{attribute: [old, new]}`. */
class ActivityChange extends Model
{
    public $timestamps = false;

    protected $fillable = ['activity_log_id', 'event', 'subject_type', 'subject_id', 'subject_label', 'diff'];

    protected function casts(): array
    {
        return ['diff' => 'array'];
    }

    public function log(): BelongsTo
    {
        return $this->belongsTo(ActivityLog::class, 'activity_log_id');
    }
}
