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
            'slug_en'      => Str::slug($title),
            'image'        => null,
            // Always published by default: the public endpoints hide drafts, so
            // a randomly-null default would make every public GET test flaky.
            // Use ->draft() for a hidden post.
            'published_at' => fake()->dateTimeBetween('-1 year', 'now'),
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
