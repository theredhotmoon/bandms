<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('fan_accounts', function (Blueprint $table) {
            // The public author name. Never derived from the email: `name`
            // defaults to the email's local part, which must not be published.
            $table->string('display_name', 50)->nullable()->after('name');
            $table->timestamp('comments_blocked_at')->nullable()->after('display_name');
        });

        Schema::table('posts', function (Blueprint $table) {
            $table->boolean('comments_enabled')->default(true)->after('published_at');
        });

        Schema::create('post_comments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('post_id')->constrained()->cascadeOnDelete();
            $table->foreignId('fan_account_id')->constrained()->cascadeOnDelete();
            $table->text('body');
            $table->timestamp('hidden_at')->nullable();
            $table->timestamps();

            $table->index(['post_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('post_comments');

        Schema::table('posts', function (Blueprint $table) {
            $table->dropColumn('comments_enabled');
        });

        Schema::table('fan_accounts', function (Blueprint $table) {
            $table->dropColumn(['display_name', 'comments_blocked_at']);
        });
    }
};
