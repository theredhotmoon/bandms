<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Gives every module an explicit per-locale URL slug.
 *
 * Until now the public slug was *derived* from the module's label:
 * web/src/lib/slugs.ts ran slugify() over module_config[..].label on every
 * build. That coupled two unrelated things — renaming "Shop" to "Merch store"
 * silently moved /en/shop to /en/merch-store and broke every inbound link.
 * The slug is now stored, and the label is free to change.
 *
 * The backfill is the whole risk of this migration. Two modules currently serve
 * a URL that is NOT their key — merch serves /en/shop, contact serves
 * /pl/kontakt — so writing the key instead of the derived value would move
 * them. slugify() below is a frozen copy of the TypeScript slugify() this
 * change deletes from slugs.ts; it exists only to reproduce the old derivation
 * once, and nothing should call it again.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('website_modules', function (Blueprint $table) {
            $table->text('custom_slug')->nullable()->after('custom_name');
        });

        foreach (DB::table('website_modules')->get() as $module) {
            $names = json_decode($module->custom_name ?? '', true) ?: [];

            $slugs = [];
            foreach (['en', 'pl'] as $locale) {
                // Mirrors WebsiteModuleController::siteConfig(): a blank
                // translation falls through to display_name, not to the key.
                $label = ($names[$locale] ?? '') ?: $module->display_name;
                $slugs[$locale] = self::slugify($label) ?: $module->slug;
            }

            DB::table('website_modules')
                ->where('id', $module->id)
                ->update(['custom_slug' => json_encode($slugs)]);
        }
    }

    public function down(): void
    {
        Schema::table('website_modules', function (Blueprint $table) {
            $table->dropColumn('custom_slug');
        });
    }

    /**
     * The derivation web/src/lib/slugs.ts used before this migration.
     *
     * `ł` is replaced first because it has no decomposed form — NFD leaves it
     * intact and the charset filter would drop it, turning "Bałkany" into
     * "ba-kany". Everything after that is Str::ascii's job: this image has no
     * intl extension, so it stands in for the TS `.normalize('NFD')` +
     * combining-mark strip. The two agree on Latin and Polish input; they
     * differ on characters Str::ascii transliterates rather than decomposes
     * (ß→"ss", æ→"ae") where the TS version would drop them to a separator.
     */
    private static function slugify(string $value): string
    {
        $value = preg_replace('/ł/iu', 'l', $value);
        $value = mb_strtolower($value, 'UTF-8');
        $value = Str::ascii($value);
        $value = preg_replace('/[^a-z0-9]+/', '-', $value);

        return trim($value, '-');
    }
};
