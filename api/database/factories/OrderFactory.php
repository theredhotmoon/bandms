<?php

namespace Database\Factories;

use App\Enums\OrderStatus;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class OrderFactory extends Factory
{
    public function definition(): array
    {
        return [
            'uuid'     => (string) Str::uuid(),
            'email'    => fake()->safeEmail(),
            'name'     => fake()->name(),
            'status'   => OrderStatus::Pending,
            'currency' => 'USD',
            'total'    => fake()->randomFloat(2, 10, 200),
            'shipping_address' => [
                'line1'       => fake()->streetAddress(),
                'city'        => fake()->city(),
                'postal_code' => fake()->postcode(),
                'country'     => 'US',
            ],
        ];
    }

    public function paid(): static
    {
        return $this->state([
            'status'                   => OrderStatus::Paid,
            'stripe_session_id'        => 'cs_test_' . Str::random(24),
            'stripe_payment_intent_id' => 'pi_test_' . Str::random(24),
        ]);
    }
}
