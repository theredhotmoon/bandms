<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * One source's crawl: how many queries it spent (the day/month caps are
 * counted from these rows), what it found, and how it ended — ok, capped at
 * its budget, or failed with the error. A failure is a row, never a silence.
 */
class AssistantRun extends Model
{
    public const STATUSES = ['ok', 'capped', 'failed'];

    protected $fillable = ['source', 'started_at', 'finished_at', 'status', 'queries', 'found', 'new', 'error'];

    protected function casts(): array
    {
        return [
            'started_at'  => 'datetime',
            'finished_at' => 'datetime',
            'queries'     => 'integer',
            'found'       => 'integer',
            'new'         => 'integer',
        ];
    }
}
