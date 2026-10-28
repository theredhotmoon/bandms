<?php

namespace App\Services;

use Stripe\Checkout\Session;
use Stripe\Coupon;
use Stripe\Stripe;

class StripeService
{
    public function createCheckoutSession(array $params): Session
    {
        Stripe::setApiKey(config('services.stripe.secret'));

        return Session::create($params);
    }

    /**
     * A single-use, fixed-amount coupon for one checkout's promo discount.
     * Returns the coupon id to pass as `discounts[].coupon`.
     */
    public function createOneOffCoupon(int $amountOffCents, string $currency, string $name): string
    {
        Stripe::setApiKey(config('services.stripe.secret'));

        return Coupon::create([
            'amount_off'      => $amountOffCents,
            'currency'        => strtolower($currency),
            'duration'        => 'once',
            'max_redemptions' => 1,
            'name'            => mb_substr($name, 0, 40),
        ])->id;
    }
}
