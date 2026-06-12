<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

class BandLogoFactory extends Factory
{
    public function definition(): array
    {
        return [
            'profile_id'    => 1,
            'file_path'     => 'logos/' . fake()->uuid() . '.png',
            'original_name' => fake()->word() . '.png',
            'mime_type'     => 'image/png',
            'file_size'     => fake()->numberBetween(10000, 500000),
            'width'         => 800,
            'height'        => 600,
            'label'         => null,
            'variant'       => 'full',
            'background'    => 'any',
            'is_default'    => false,
            'is_deprecated' => false,
            'version_label' => null,
            'notes'         => null,
            'sort_order'    => 0,
        ];
    }

    public function default(): static
    {
        return $this->state(['is_default' => true]);
    }

    public function deprecated(): static
    {
        return $this->state(['is_deprecated' => true, 'is_default' => false]);
    }

    public function svg(): static
    {
        return $this->state([
            'file_path'  => 'logos/' . fake()->uuid() . '.svg',
            'mime_type'  => 'image/svg+xml',
            'width'      => null,
            'height'     => null,
        ]);
    }
}
