<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password;

/**
 * Create an admin user from the command line.
 *
 * The database seeder no longer ships a hardcoded admin (it published known
 * credentials on the first production boot), so a fresh deployment needs some
 * way to make its first login. This is it:
 *
 *   docker exec -it bandms-backend php artisan bandms:create-admin
 *
 * Prompts for the password when it is not passed as an option, so the value
 * never lands in shell history.
 */
class CreateAdminUser extends Command
{
    protected $signature = 'bandms:create-admin
                            {--email= : Email address for the new admin}
                            {--password= : Password (prompted for if omitted)}
                            {--first-name=Admin : First name}
                            {--last-name=User : Last name}';

    protected $description = 'Create an admin user (use on a fresh deployment)';

    public function handle(): int
    {
        $email = $this->option('email') ?: $this->ask('Email address');

        if (User::where('email', $email)->exists()) {
            $this->error("A user with the email {$email} already exists.");

            return self::FAILURE;
        }

        $password = $this->option('password') ?: $this->secret('Password');

        $validator = Validator::make(
            ['email' => $email, 'password' => $password],
            [
                'email'    => ['required', 'email', 'max:255'],
                'password' => ['required', 'string', Password::min(12)->letters()->numbers()],
            ]
        );

        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $error) {
                $this->error($error);
            }

            return self::FAILURE;
        }

        User::create([
            'first_name' => $this->option('first-name'),
            'last_name'  => $this->option('last-name'),
            'email'      => $email,
            'password'   => $password,
            'role'       => 'admin',
        ]);

        $this->info("Admin user {$email} created.");

        return self::SUCCESS;
    }
}
