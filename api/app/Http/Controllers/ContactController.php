<?php

namespace App\Http\Controllers;

use App\Mail\ContactInquiry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;

class ContactController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        // Honeypot — bots fill the hidden `website` field; humans never see it.
        if (!empty($request->input('website'))) {
            return response()->json(['message' => 'Message sent.'], 201);
        }

        $data = $request->validate([
            'reason'  => ['required', 'in:general,booking,press,other'],
            'name'    => ['required', 'string', 'max:255'],
            'email'   => ['required', 'email', 'max:255'],
            'subject' => ['nullable', 'string', 'max:255'],
            'message' => ['required', 'string', 'max:5000'],
        ]);

        $to = config('contact.email') ?: 'hello@skankingstorks.com';

        Mail::to($to)->send(new ContactInquiry($data));

        return response()->json(['message' => 'Message sent.'], 201);
    }
}
