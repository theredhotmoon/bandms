<?php

namespace Database\Factories;

use App\Models\ShopItem;
use Illuminate\Database\Eloquent\Factories\Factory;

class ShopItemVariantFactory extends Factory
{
    public function definition(): array
    {
        return [
            'shop_item_id'   => ShopItem::factory(),
            'name'           => 'Size',
            'value'          => fake()->randomElement(['S', 'M', 'L', 'XL']),
            'stock_quantity' => fake()->optional()->numberBetween(0, 100),
            'sort_order'     => 0,
        ];
    }

    public function soldOut(): static
    {
        return $this->state(['stock_quantity' => 0]);
    }

    public function unlimited(): static
    {
        return $this->state(['stock_quantity' => null]);
    }
}
