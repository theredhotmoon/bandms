<?php

namespace App\Services;

use Stripe\Checkout\Session;
use Stripe\Stripe;

class StripeService
{
    public function createCheckoutSession(array $params): Session
    {
        Stripe::setApiKey(config('services.stripe.secret'));

        return Session::create($params);
    }
}
