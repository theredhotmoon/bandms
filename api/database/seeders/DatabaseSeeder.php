<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->seedAdminUser();
        $this->seedDemoData();

        DB::table('band_profiles')->insertOrIgnore([[
            'id'         => 1,
            'name'       => 'My Band',
            'created_at' => now(),
            'updated_at' => now(),
        ]]);

        // Every row handed to one insert must carry an identical key set.
        // Illuminate builds the INSERT column list from the *first* row and
        // then flattens the bindings from all of them, so a row with an extra
        // key shifts every value after it and the statement dies with
        // "SQLSTATE[21S01]: Column count doesn't match value count at row N".
        //
        // That is exactly what happened: most rows had six keys, `merch` added
        // `custom_slug` and `contact` added `custom_name` too, so the seeder
        // blew up on row 7 — and with it `migrate:fresh --seed`, `make fresh`
        // and `rebuild.sh --fresh-db`, all of which had already wiped the
        // database by that point.
        //
        // Declaring the optional columns once keeps the widths uniform no
        // matter which row sets them, so adding a module with a custom slug
        // cannot bring this back.
        $moduleDefaults = [
            'custom_name' => null,
            'custom_slug' => null,
            'enabled'     => true,
            'created_at'  => now(),
            'updated_at'  => now(),
        ];

        $modules = [
            ['slug' => 'concerts',   'display_name' => 'Concerts',   'sort_order' => 1],
            ['slug' => 'releases',   'display_name' => 'Releases',   'sort_order' => 2],
            ['slug' => 'posts',      'display_name' => 'News',       'sort_order' => 3],
            ['slug' => 'photos',     'display_name' => 'Photos',     'sort_order' => 4],
            ['slug' => 'press',      'display_name' => 'Press',      'sort_order' => 5],
            ['slug' => 'videos',     'display_name' => 'Videos',     'sort_order' => 6],
            ['slug' => 'merch',      'display_name' => 'Shop',       'sort_order' => 7,  'custom_slug' => json_encode(['en' => 'shop', 'pl' => 'shop'])],
            ['slug' => 'epk',        'display_name' => 'EPK',        'sort_order' => 8],
            ['slug' => 'tech-rider', 'display_name' => 'Tech Rider', 'sort_order' => 9],
            ['slug' => 'newsletter', 'display_name' => 'Newsletter', 'sort_order' => 10],
            ['slug' => 'contact',    'display_name' => 'Contact',    'sort_order' => 11, 'custom_name' => json_encode(['pl' => 'Kontakt']), 'custom_slug' => json_encode(['en' => 'contact', 'pl' => 'kontakt'])],
        ];

        DB::table('website_modules')->insertOrIgnore(
            array_map(static fn (array $module): array => array_merge($moduleDefaults, $module), $modules)
        );

        DB::table('site_settings')->insertOrIgnore([
            ['key' => 'auto_rebuild', 'value' => 'false', 'created_at' => now(), 'updated_at' => now()],
        ]);
    }

    /**
     * Create the initial admin, but only from credentials supplied by the
     * environment.
     *
     * This used to hardcode admin@bandms.test / "password". The container
     * entrypoint runs this seeder on any empty database, so a first production
     * boot published a known-credential admin account on the public internet.
     *
     * Gating on APP_ENV would not help: docker-compose.yml sets
     * APP_ENV=production for the local stack too. Requiring the credentials to
     * be named explicitly makes production safe by default — nothing is
     * created unless someone chose the values — while the dev stack and the
     * E2E suite keep their fixed login by declaring it in compose.
     */
    private function seedAdminUser(): void
    {
        $email    = env('ADMIN_EMAIL');
        $password = env('ADMIN_PASSWORD');

        if (blank($email) || blank($password)) {
            $this->command?->warn(
                'No ADMIN_EMAIL / ADMIN_PASSWORD set — skipping admin user. '
                .'Create one with: php artisan bandms:create-admin'
            );

            return;
        }

        DB::table('users')->insertOrIgnore([[
            'first_name' => env('ADMIN_FIRST_NAME', 'Admin'),
            'last_name'  => env('ADMIN_LAST_NAME', 'User'),
            'email'      => $email,
            'password'   => Hash::make($password),
            'role'       => 'admin',
            'created_at' => now(),
            'updated_at' => now(),
        ]]);
    }

    /**
     * Placeholder venue and concert. Useful locally and for the E2E suite,
     * noise in production — so it is opt-in via SEED_DEMO_DATA.
     */
    private function seedDemoData(): void
    {
        if (! filter_var(env('SEED_DEMO_DATA', false), FILTER_VALIDATE_BOOLEAN)) {
            return;
        }

        DB::table('venues')->insertOrIgnore([[
            'id'         => 1,
            'name'       => 'Test Venue',
            'city'       => 'Kraków',
            'created_at' => now(),
            'updated_at' => now(),
        ]]);

        DB::table('concerts')->insertOrIgnore([[
            'id'         => 1,
            'venue_id'   => 1,
            'date'       => '2099-12-31',
            'start_time' => '20:00:00',
            'created_at' => now(),
            'updated_at' => now(),
        ]]);
    }
}
