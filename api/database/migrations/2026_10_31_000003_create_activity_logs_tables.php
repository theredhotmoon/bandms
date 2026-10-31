<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Who changed what, and when.
 *
 * One `activity_logs` row per request (or job) that wrote something — the
 * person, the route and the record it named. Its `activity_changes` are the
 * individual Eloquent writes inside it, with old → new values. See
 * docs/superpowers/specs/2026-10-30-activity-log-design.md.
 *
 * Names and labels are snapshots, not joins: a deleted user or a deleted post
 * must still read as someone and something in its own history.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('activity_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('user_name')->nullable();
            $table->string('action', 32);
            $table->string('method', 10)->nullable();
            $table->string('route')->nullable();
            $table->string('subject_type', 64)->nullable();
            $table->unsignedBigInteger('subject_id')->nullable();
            $table->string('subject_label')->nullable();
            $table->string('ip', 45)->nullable();
            $table->timestamp('created_at')->index();

            $table->index(['subject_type', 'subject_id']);
        });

        Schema::create('activity_changes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('activity_log_id')->constrained()->cascadeOnDelete();
            $table->string('event', 16);
            $table->string('subject_type', 64);
            $table->unsignedBigInteger('subject_id')->nullable();
            $table->string('subject_label')->nullable();
            $table->json('diff')->nullable();

            $table->index(['subject_type', 'subject_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('activity_changes');
        Schema::dropIfExists('activity_logs');
    }
};
