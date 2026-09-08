<?php

namespace Database\Factories;

use App\Models\BandProfile;
use Illuminate\Database\Eloquent\Factories\Factory;

class PressReleaseFactory extends Factory
{
    public function definition(): array
    {
        return [
            'profile_id' => BandProfile::factory(),
            'url'        => fake()->unique()->url(),
            'og_title'   => fake()->sentence(),
            'og_site_name' => fake()->domainWord() . '.com',
            'published_at' => fake()->dateTime(),
            'featured'   => false,
        ];
    }
}
