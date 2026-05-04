<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

class BandFactory extends Factory
{
    public function definition(): array
    {
        return [
            'name' => fake()->words(fake()->numberBetween(1, 3), true),
        ];
    }
}
