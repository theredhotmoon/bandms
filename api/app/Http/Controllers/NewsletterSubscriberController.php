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
use Illuminate\Validation\Rule;

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

        if (!$this->domainResolves($email)) {
            return $this->invalidDomain();
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

    /**
     * Admin edit. A changed address has never agreed to anything, so it goes
     * back to pending with a fresh confirmation token and a new confirmation
     * mail — the double opt-in must hold for the address actually stored.
     * The old token is replaced so a link mailed to the previous address
     * cannot confirm the new one.
     */
    public function update(Request $request, NewsletterSubscriber $subscriber): JsonResponse
    {
        // Normalise only a string: a non-scalar must reach the validator and
        // come back as a 422, not die in the cast as a 500.
        if (is_string($request->input('email'))) {
            $request->merge(['email' => strtolower(trim($request->input('email')))]);
        }

        $data = $request->validate([
            'email' => ['required', 'string', 'email', 'max:255', Rule::unique('newsletter_subscribers', 'email')->ignore($subscriber->id)],
            'name'  => ['nullable', 'string', 'max:255'],
        ]);

        // Compared lower-cased on both sides, as the admin compares: a row
        // stored before sign-up lower-cased ("Fan@Music.com") is the same
        // address, and a rename must not silently send it back to pending.
        $emailChanged = $data['email'] !== strtolower($subscriber->email);

        if ($emailChanged && !$this->domainResolves($data['email'])) {
            return $this->invalidDomain();
        }

        $subscriber->fill([
            'email' => $data['email'],
            'name'  => filled($data['name'] ?? null) ? trim($data['name']) : null,
        ]);

        if ($emailChanged) {
            // Both tokens rotate: links mailed to the previous address must
            // neither confirm nor unsubscribe the new one.
            $subscriber->fill([
                'confirmed_at'       => null,
                'confirmation_token' => Str::random(64),
                'unsubscribe_token'  => Str::random(64),
            ]);
        }

        $subscriber->save();

        // The change is saved whatever the mailer does. A failed send is
        // reported, not thrown — a 500 here would tell the admin the save
        // failed when it did not.
        $confirmationSent = false;
        if ($emailChanged) {
            try {
                Mail::to($subscriber->email)->send(new NewsletterConfirmation($subscriber));
                $confirmationSent = true;
            } catch (\Throwable $e) {
                report($e);
            }
        }

        return (new NewsletterSubscriberResource($subscriber))
            ->additional(['email_changed' => $emailChanged, 'confirmation_sent' => $confirmationSent])
            ->response();
    }

    public function destroy(NewsletterSubscriber $subscriber): JsonResponse
    {
        $subscriber->delete();
        return response()->json(null, 204);
    }

    private function domainResolves(string $email): bool
    {
        if (!config('newsletter.verify_mx', true)) {
            return true;
        }

        $domain = substr(strrchr($email, '@'), 1);

        return checkdnsrr($domain, 'MX') || checkdnsrr($domain, 'A');
    }

    private function invalidDomain(): JsonResponse
    {
        return response()->json([
            'message' => 'The email address domain does not appear to be valid.',
            'errors'  => ['email' => ['The email address domain does not appear to be valid.']],
        ], 422);
    }
}
