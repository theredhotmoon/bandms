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
    }
}
