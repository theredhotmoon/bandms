<?php

namespace Database\Factories;

use App\Models\Post;
use Illuminate\Database\Eloquent\Factories\Factory;

class PostBlockFactory extends Factory
{
    public function definition(): array
    {
        return [
            'post_id'  => Post::factory(),
            'position' => 0,
            'type'     => 'text',
            'payload'  => ['body' => ['en' => fake()->paragraph(), 'pl' => null]],
        ];
    }

    public function text(string $en, ?string $pl = null): static
    {
        return $this->state(['type' => 'text', 'payload' => ['body' => ['en' => $en, 'pl' => $pl]]]);
    }

    public function ref(string $entity, int $id): static
    {
        return $this->state(['type' => 'ref', 'payload' => ['entity' => $entity, 'id' => $id]]);
    }

    public function embed(string $url, string $provider = 'link', ?string $label = null): static
    {
        return $this->state([
            'type'    => 'embed',
            'payload' => ['provider' => $provider, 'url' => $url, 'label' => $label],
        ]);
    }

    public function image(string $path): static
    {
        return $this->state([
            'type'    => 'image',
            'payload' => ['path' => $path, 'alt' => ['en' => null, 'pl' => null], 'caption' => ['en' => null, 'pl' => null]],
        ]);
    }

    public function at(int $position): static
    {
        return $this->state(['position' => $position]);
    }
}
