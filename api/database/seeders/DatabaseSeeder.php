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

        DB::table('website_modules')->insertOrIgnore([
            ['slug' => 'concerts',   'display_name' => 'Concerts',   'enabled' => true, 'sort_order' => 1,  'created_at' => now(), 'updated_at' => now()],
            ['slug' => 'releases',   'display_name' => 'Releases',   'enabled' => true, 'sort_order' => 2,  'created_at' => now(), 'updated_at' => now()],
            ['slug' => 'posts',      'display_name' => 'News',       'enabled' => true, 'sort_order' => 3,  'created_at' => now(), 'updated_at' => now()],
            ['slug' => 'photos',     'display_name' => 'Photos',     'enabled' => true, 'sort_order' => 4,  'created_at' => now(), 'updated_at' => now()],
            ['slug' => 'press',      'display_name' => 'Press',      'enabled' => true, 'sort_order' => 5,  'created_at' => now(), 'updated_at' => now()],
            ['slug' => 'videos',     'display_name' => 'Videos',     'enabled' => true, 'sort_order' => 6,  'created_at' => now(), 'updated_at' => now()],
            ['slug' => 'merch',      'display_name' => 'Shop',       'enabled' => true, 'sort_order' => 7,  'created_at' => now(), 'updated_at' => now(), 'custom_slug' => json_encode(['en' => 'shop', 'pl' => 'shop'])],
            ['slug' => 'epk',        'display_name' => 'EPK',        'enabled' => true, 'sort_order' => 8,  'created_at' => now(), 'updated_at' => now()],
            ['slug' => 'tech-rider', 'display_name' => 'Tech Rider', 'enabled' => true, 'sort_order' => 9,  'created_at' => now(), 'updated_at' => now()],
            ['slug' => 'newsletter', 'display_name' => 'Newsletter', 'enabled' => true, 'sort_order' => 10, 'created_at' => now(), 'updated_at' => now()],
            ['slug' => 'contact',    'display_name' => 'Contact',    'enabled' => true, 'sort_order' => 11, 'created_at' => now(), 'updated_at' => now(), 'custom_name' => json_encode(['pl' => 'Kontakt']), 'custom_slug' => json_encode(['en' => 'contact', 'pl' => 'kontakt'])],
        ]);

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
