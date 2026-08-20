<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        DB::table('users')->insertOrIgnore([[
            'first_name' => 'Admin',
            'last_name'  => 'User',
            'email'      => 'admin@bandms.test',
            'password'   => Hash::make('password'),
            'created_at' => now(),
            'updated_at' => now(),
        ]]);

        DB::table('band_profiles')->insertOrIgnore([[
            'id'         => 1,
            'name'       => 'My Band',
            'created_at' => now(),
            'updated_at' => now(),
        ]]);

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

        DB::table('website_modules')->insertOrIgnore([
            ['slug' => 'concerts',   'display_name' => 'Concerts',   'enabled' => true, 'sort_order' => 1,  'created_at' => now(), 'updated_at' => now()],
            ['slug' => 'releases',   'display_name' => 'Releases',   'enabled' => true, 'sort_order' => 2,  'created_at' => now(), 'updated_at' => now()],
            ['slug' => 'posts',      'display_name' => 'News',       'enabled' => true, 'sort_order' => 3,  'created_at' => now(), 'updated_at' => now()],
            ['slug' => 'photos',     'display_name' => 'Photos',     'enabled' => true, 'sort_order' => 4,  'created_at' => now(), 'updated_at' => now()],
            ['slug' => 'press',      'display_name' => 'Press',      'enabled' => true, 'sort_order' => 5,  'created_at' => now(), 'updated_at' => now()],
            ['slug' => 'videos',     'display_name' => 'Videos',     'enabled' => true, 'sort_order' => 6,  'created_at' => now(), 'updated_at' => now()],
            ['slug' => 'merch',      'display_name' => 'Shop',       'enabled' => true, 'sort_order' => 7,  'created_at' => now(), 'updated_at' => now()],
            ['slug' => 'epk',        'display_name' => 'EPK',        'enabled' => true, 'sort_order' => 8,  'created_at' => now(), 'updated_at' => now()],
            ['slug' => 'tech-rider', 'display_name' => 'Tech Rider', 'enabled' => true, 'sort_order' => 9,  'created_at' => now(), 'updated_at' => now()],
            ['slug' => 'newsletter', 'display_name' => 'Newsletter', 'enabled' => true, 'sort_order' => 10, 'created_at' => now(), 'updated_at' => now()],
        ]);

        DB::table('site_settings')->insertOrIgnore([
            ['key' => 'auto_rebuild', 'value' => 'false', 'created_at' => now(), 'updated_at' => now()],
        ]);
    }
}
