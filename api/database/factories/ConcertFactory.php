<?php

namespace Database\Factories;

use App\Models\Venue;
use Illuminate\Database\Eloquent\Factories\Factory;

class ConcertFactory extends Factory
{
    public function definition(): array
    {
        return [
            'venue_id'   => Venue::factory(),
            'date'       => fake()->dateTimeBetween('now', '+1 year')->format('Y-m-d'),
            'start_time' => fake()->optional(0.7)->time('H:i'),
            'description' => fake()->optional()->paragraph(),
        ];
    }
}
