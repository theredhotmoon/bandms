<?php

namespace Database\Factories;

use App\Models\BandProfile;
use Illuminate\Database\Eloquent\Factories\Factory;

class BandProfileFactory extends Factory
{
    protected $model = BandProfile::class;

    public function definition(): array
    {
        return [
            'name' => fake()->words(fake()->numberBetween(1, 3), true),
        ];
    }
}
