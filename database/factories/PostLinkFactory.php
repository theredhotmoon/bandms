<?php

namespace Database\Factories;

use App\Models\Post;
use Illuminate\Database\Eloquent\Factories\Factory;

class PostLinkFactory extends Factory
{
    private static array $types = ['youtube', 'instagram', 'facebook', 'normal'];

    public function definition(): array
    {
        $type = fake()->randomElement(self::$types);

        return [
            'post_id'    => Post::factory(),
            'type'       => $type,
            'url'        => fake()->url(),
            'label'      => $type === 'normal' ? fake()->optional()->words(3, true) : null,
            'sort_order' => 0,
        ];
    }
}
