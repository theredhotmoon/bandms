<?php

namespace Database\Factories;

use App\Models\SocialLink;
use Illuminate\Database\Eloquent\Factories\Factory;

class SocialLinkFactory extends Factory
{
    protected $model = SocialLink::class;

    public function definition(): array
    {
        return [
            'profile_id' => 1,
            'platform'   => fake()->randomElement(['spotify', 'instagram', 'facebook', 'youtube', 'bandcamp']),
            'url'        => fake()->url(),
        ];
    }
}
