<?php

namespace Database\Factories;

use App\Models\BandProfile;
use Illuminate\Database\Eloquent\Factories\Factory;

class ReleaseFactory extends Factory
{
    public function definition(): array
    {
        return [
            'profile_id'   => BandProfile::factory(),
            'title'        => fake()->words(3, true),
            'type'         => fake()->randomElement(['LP', 'EP', 'Single']),
            'release_date' => fake()->date(),
        ];
    }
}
