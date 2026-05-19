<?php

namespace App\Http\Controllers;

use App\Http\Resources\NewsletterSubscriberResource;
use App\Models\NewsletterSubscriber;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class NewsletterSubscriberController extends Controller
{
    public function subscribe(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email'  => ['required', 'email', 'max:255'],
            'name'   => ['nullable', 'string', 'max:255'],
            'source' => ['nullable', 'string', 'max:100'],
        ]);

        $existing = NewsletterSubscriber::where('email', $data['email'])->first();
        if ($existing) {
            return response()->json(['message' => 'Already subscribed.'], 200);
        }

        NewsletterSubscriber::create([
            'email'         => $data['email'],
            'name'          => $data['name'] ?? null,
            'source'        => $data['source'] ?? 'website',
            'subscribed_at' => now(),
        ]);

        return response()->json(['message' => 'Subscribed successfully.'], 201);
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
