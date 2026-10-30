<?php

use Illuminate\Support\Facades\DB;

// The migration that introduced superadmin flags every existing admin, so the
// band's current admins keep managing users and the assistant on day one.

it('flags every admin as superadmin and leaves others alone', function () {
    $migration = require database_path('migrations/2026_10_31_000001_add_assistant_permissions_to_users.php');

    $migration->down();
    DB::table('users')->insert([
        ['first_name' => 'A', 'last_name' => 'A', 'email' => 'a@x.test', 'password' => 'x', 'role' => 'admin', 'created_at' => now(), 'updated_at' => now()],
        ['first_name' => 'M', 'last_name' => 'M', 'email' => 'm@x.test', 'password' => 'x', 'role' => 'member', 'created_at' => now(), 'updated_at' => now()],
    ]);
    $migration->up();

    expect((bool) DB::table('users')->where('email', 'a@x.test')->value('is_superadmin'))->toBeTrue()
        ->and((bool) DB::table('users')->where('email', 'm@x.test')->value('is_superadmin'))->toBeFalse()
        ->and((bool) DB::table('users')->where('email', 'm@x.test')->value('can_enhance'))->toBeFalse();
});
