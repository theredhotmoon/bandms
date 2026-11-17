<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

class ClipFactory extends Factory
{
    public function definition(): array
    {
        return [
            'provider'    => 'youtube',
            'url'         => 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            'title'       => ['en' => fake()->sentence(3), 'pl' => null],
            'category'    => 'live',
            'recorded_on' => fake()->optional()->date(),
            'show_in_epk' => false,
            'source'      => 'official',
        ];
    }

    /** Someone else filmed it; the band shows it with a credit. */
    public function fan(string $channel = 'Gig Goer', string $url = 'https://www.youtube.com/@giggoer'): static
    {
        return $this->state(['source' => 'fan', 'category' => 'live', 'channel_name' => $channel, 'channel_url' => $url]);
    }
}
