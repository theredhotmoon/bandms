<?php

namespace Database\Factories;

use App\Models\BandMember;
use Illuminate\Database\Eloquent\Factories\Factory;

class BandMemberFactory extends Factory
{
    protected $model = BandMember::class;

    public function definition(): array
    {
        return [
            'profile_id' => 1,
            'first_name' => fake()->firstName(),
            'last_name'  => fake()->lastName(),
            'role'       => fake()->randomElement(['Vocals', 'Guitar', 'Bass', 'Drums', 'Keyboard']),
            'is_current' => true,
            'sort_order' => 0,
            'can_login'  => false,
        ];
    }
}
