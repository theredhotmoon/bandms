<?php

namespace Database\Factories;

use App\Models\FanAccount;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<FanAccount> */
class FanAccountFactory extends Factory
{
    public function definition(): array
    {
        return [
            'email' => fake()->unique()->safeEmail(),
            'name'  => fake()->name(),
        ];
    }
}
