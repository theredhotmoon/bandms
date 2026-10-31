<?php

namespace Database\Factories;

use App\Models\AssistantFinding;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<AssistantFinding> */
class AssistantFindingFactory extends Factory
{
    protected $model = AssistantFinding::class;

    public function definition(): array
    {
        $url = fake()->unique()->url();

        return [
            'kind'         => 'mention',
            'source'       => 'google_cse',
            'external_key' => sha1($url),
            'url'          => $url,
            'title'        => fake()->sentence(6),
            'snippet'      => fake()->sentence(12),
            'found_at'     => now(),
        ];
    }

    public function lead(string $type = 'venue'): static
    {
        return $this->state(['kind' => 'lead', 'lead_type' => $type]);
    }

    public function dismissed(): static
    {
        return $this->state(['status' => 'dismissed']);
    }
}
