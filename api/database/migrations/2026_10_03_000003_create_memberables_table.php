<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Which band members appear in, or belong to, a piece of content — photos
 * first, then news, concerts and the rest (see App\Support\MemberLinks).
 *
 * One polymorphic many-to-many, like `clippables`: a photo can show several
 * members and a member any number of photos. `memberable_type` stores the
 * morph *alias*, so it is data — never rename one. The member side cascades;
 * the content side cannot (it is polymorphic), so HasMembers detaches on delete.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('memberables', function (Blueprint $table) {
            $table->foreignId('band_member_id')->constrained()->cascadeOnDelete();
            $table->string('memberable_type', 32);
            $table->unsignedBigInteger('memberable_id');

            $table->primary(['band_member_id', 'memberable_type', 'memberable_id']);
            $table->index(['memberable_type', 'memberable_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('memberables');
    }
};
