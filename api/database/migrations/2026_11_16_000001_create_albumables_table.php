<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Photo albums linked from news, concerts, releases and merch.
 *
 * `albumables` is a polymorphic many-to-many, the same shape as `clippables`:
 * one album can be linked from any number of records, and the owner side
 * stores the morph alias from App\Support\AlbumLinks::MAP.
 *
 * An album's own `concert_id` ("the gig these photos are from") stays as it
 * is. It is backfilled here as a link, so a concert's admin form opens with
 * the albums shot at it already ticked, and AlbumController adds the link
 * whenever that field is set later.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('albumables', function (Blueprint $table) {
            $table->foreignId('album_id')->constrained()->cascadeOnDelete();
            $table->string('albumable_type', 32);
            $table->unsignedBigInteger('albumable_id');
            $table->unsignedSmallInteger('position')->default(0);

            $table->unique(['album_id', 'albumable_type', 'albumable_id']);
            $table->index(['albumable_type', 'albumable_id', 'position']);
        });

        $rows = DB::table('albums')
            ->join('concerts', 'concerts.id', '=', 'albums.concert_id')
            ->select('albums.id as album_id', 'albums.concert_id')
            ->get()
            ->map(fn ($r) => [
                'album_id'       => $r->album_id,
                'albumable_type' => 'concert',
                'albumable_id'   => $r->concert_id,
                'position'       => 0,
            ])
            ->all();

        if ($rows !== []) {
            DB::table('albumables')->insert($rows);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('albumables');
    }
};
