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
            // Must match the releases.type enum exactly — note the lowercase 'single'.
            'type'         => fake()->randomElement(['LP', 'EP', 'single', 'compilation']),
            'release_date' => fake()->date(),
        ];
    }
}
