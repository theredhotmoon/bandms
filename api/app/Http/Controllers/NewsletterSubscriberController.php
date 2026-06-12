<?php

namespace App\Http\Controllers;

use App\Http\Resources\NewsletterSubscriberResource;
use App\Mail\NewsletterConfirmation;
use App\Models\NewsletterSubscriber;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class NewsletterSubscriberController extends Controller
{
    public function subscribe(Request $request): JsonResponse
    {
        // Honeypot: silently succeed but never store if a bot filled the hidden field.
        if (!empty($request->input('website'))) {
            return response()->json(['message' => 'Check your inbox to confirm your subscription.'], 201);
        }

        $data = $request->validate([
            'email'  => ['required', 'email', 'max:255'],
            'name'   => ['nullable', 'string', 'max:255'],
            'source' => ['nullable', 'string', 'max:100'],
        ]);

        $email = strtolower(trim($data['email']));

        if (config('newsletter.verify_mx', true)) {
            $domain = substr(strrchr($email, '@'), 1);
            if (!checkdnsrr($domain, 'MX') && !checkdnsrr($domain, 'A')) {
                return response()->json([
                    'message' => 'The email address domain does not appear to be valid.',
                    'errors'  => ['email' => ['The email address domain does not appear to be valid.']],
                ], 422);
            }
        }

        $existing = NewsletterSubscriber::where('email', $email)->first();

        if ($existing) {
            if ($existing->isConfirmed()) {
                return response()->json(['message' => 'You are already subscribed.'], 200);
            }

            // Pending — regenerate token and resend inside a transaction to avoid
            // a race where two concurrent requests each send a different token.
            $subscriber = DB::transaction(function () use ($existing) {
                $existing->update(['confirmation_token' => Str::random(64)]);
                return $existing->fresh();
            });
            Mail::to($subscriber->email)->send(new NewsletterConfirmation($subscriber));

            return response()->json(['message' => 'Check your inbox to confirm your subscription.'], 200);
        }

        $subscriber = NewsletterSubscriber::create([
            'email'              => $email,
            'name'               => $data['name'] ?? null,
            'source'             => $data['source'] ?? 'website',
            'subscribed_at'      => now(),
            'confirmation_token' => Str::random(64),
            'unsubscribe_token'  => Str::random(64),
        ]);

        Mail::to($subscriber->email)->send(new NewsletterConfirmation($subscriber));

        return response()->json(['message' => 'Check your inbox to confirm your subscription.'], 201);
    }

    public function confirm(string $token): JsonResponse
    {
        $subscriber = NewsletterSubscriber::where('confirmation_token', $token)->first();

        if (!$subscriber) {
            return response()->json(['message' => 'Invalid or expired confirmation link.'], 404);
        }

        $subscriber->update([
            'confirmed_at'       => now(),
            'confirmation_token' => null,
        ]);

        return response()->json(['message' => 'Your subscription has been confirmed.'], 200);
    }

    public function unsubscribe(string $token): JsonResponse
    {
        $subscriber = NewsletterSubscriber::where('unsubscribe_token', $token)->first();

        if (!$subscriber) {
            return response()->json(['message' => 'Invalid unsubscribe link.'], 404);
        }

        $subscriber->delete();

        return response()->json(['message' => 'You have been unsubscribed.'], 200);
    }

    public function index(): AnonymousResourceCollection
    {
        $subscribers = NewsletterSubscriber::latest('subscribed_at')->paginate(50);
        return NewsletterSubscriberResource::collection($subscribers);
    }

    public function destroy(NewsletterSubscriber $subscriber): JsonResponse
    {
        $subscriber->delete();
        return response()->json(null, 204);
    }
}
