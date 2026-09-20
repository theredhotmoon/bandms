<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

class ClipFactory extends Factory
{
    public function definition(): array
    {
        return [
            'provider'    => 'youtube',
            'url'         => 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            'title'       => ['en' => fake()->sentence(3), 'pl' => null],
            'category'    => 'live',
            'recorded_on' => fake()->optional()->date(),
            'show_in_epk' => false,
        ];
    }
}
