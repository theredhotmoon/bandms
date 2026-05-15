<?php

namespace App\Http\Controllers;

use App\Http\Resources\AllowedEmailResource;
use App\Models\AllowedEmail;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class AllowedEmailController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return AllowedEmailResource::collection(
            AllowedEmail::orderBy('email')->get()
        );
    }

    public function store(Request $request): AllowedEmailResource
    {
        $data = $request->validate([
            'email'          => ['required', 'email', 'max:255', 'unique:allowed_emails,email'],
            'role'           => ['required', 'string', 'in:admin,member,publisher'],
            'band_member_id' => ['nullable', 'integer', 'exists:band_members,id'],
            'notes'          => ['nullable', 'string', 'max:1000'],
        ]);

        return new AllowedEmailResource(AllowedEmail::create($data));
    }

    public function update(Request $request, AllowedEmail $allowedEmail): AllowedEmailResource
    {
        $data = $request->validate([
            'email'          => ['sometimes', 'email', 'max:255', Rule::unique('allowed_emails', 'email')->ignore($allowedEmail->id)],
            'role'           => ['sometimes', 'string', 'in:admin,member,publisher'],
            'band_member_id' => ['nullable', 'integer', 'exists:band_members,id'],
            'notes'          => ['nullable', 'string', 'max:1000'],
        ]);

        $allowedEmail->update($data);

        return new AllowedEmailResource($allowedEmail->fresh());
    }

    public function destroy(AllowedEmail $allowedEmail): JsonResponse
    {
        $allowedEmail->delete();
        return response()->json(null, 204);
    }
}
