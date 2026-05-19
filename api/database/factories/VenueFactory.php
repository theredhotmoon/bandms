<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

class VenueFactory extends Factory
{
    public function definition(): array
    {
        return [
            'name'          => fake()->company() . ' Club',
            'street'        => fake()->streetName(),
            'street_number' => (string) fake()->buildingNumber(),
            'city'          => fake()->city(),
            'postcode'      => fake()->postcode(),
            'latitude'      => fake()->latitude(),
            'longitude'     => fake()->longitude(),
        ];
    }
}
