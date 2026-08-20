<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class ShopItemFactory extends Factory
{
    public function definition(): array
    {
        $name = fake()->unique()->words(3, true);

        return [
            'profile_id'   => 1,
            'name'         => ucwords($name),
            'slug_en'      => Str::slug($name),
            'type'         => fake()->randomElement(['record', 'apparel', 'accessory', 'ticket', 'bundle', 'other']),
            'description'  => fake()->optional()->sentence(),
            'is_available' => true,
            'is_presale'   => false,
            'sort_order'   => 0,
        ];
    }

    public function unavailable(): static
    {
        return $this->state(['is_available' => false]);
    }

    public function presale(): static
    {
        return $this->state(['is_presale' => true, 'presale_ships_at' => now()->addMonths(2)->format('Y-m-d')]);
    }
}
