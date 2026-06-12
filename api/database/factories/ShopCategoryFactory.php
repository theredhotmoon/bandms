<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class ShopCategoryFactory extends Factory
{
    public function definition(): array
    {
        $name = fake()->unique()->words(2, true);

        return [
            'profile_id'  => 1,
            'name'        => ucwords($name),
            'slug'        => Str::slug($name),
            'description' => null,
            'sort_order'  => 0,
        ];
    }
}
