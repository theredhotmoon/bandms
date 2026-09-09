<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

class InstrumentFactory extends Factory
{
    public function definition(): array
    {
        return [
            'name'     => ['en' => ucfirst(fake()->unique()->word())],
            'category' => null,
        ];
    }
}
