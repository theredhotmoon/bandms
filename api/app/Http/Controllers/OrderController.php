<?php

namespace App\Http\Controllers;

use App\Http\Resources\OrderResource;
use App\Models\Order;

class OrderController extends Controller
{
    public function show(string $uuid): OrderResource
    {
        $order = Order::where('uuid', $uuid)->with('items')->firstOrFail();

        return new OrderResource($order);
    }
}
