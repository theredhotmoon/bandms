<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

class VenueFactory extends Factory
{
    public function definition(): array
    {
        return [
            'name'      => fake()->company() . ' Club',
            'address'   => fake()->address(),
            'latitude'  => fake()->latitude(),
            'longitude' => fake()->longitude(),
        ];
    }
}
