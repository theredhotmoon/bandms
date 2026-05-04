<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class PostFactory extends Factory
{
    public function definition(): array
    {
        $title = fake()->sentence(6, false);

        return [
            'title'        => rtrim($title, '.'),
            'slug'         => Str::slug($title),
            'content'      => fake()->paragraphs(3, true),
            'image'        => null,
            'published_at' => fake()->optional(0.8)->dateTimeBetween('-1 year', 'now'),
        ];
    }

    public function published(): static
    {
        return $this->state(['published_at' => now()]);
    }

    public function draft(): static
    {
        return $this->state(['published_at' => null]);
    }
}
