<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class UserController extends Controller
{
    public function index(): JsonResponse
    {
        $users = User::with('bandMember')
            ->orderBy('role')
            ->orderBy('last_name')
            ->get()
            ->map(fn (User $u) => $this->format($u));

        return response()->json($users);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'first_name'     => ['required', 'string', 'max:100'],
            'last_name'      => ['required', 'string', 'max:100'],
            'email'          => ['required', 'email:rfc', 'max:255', 'unique:users,email'],
            'password'       => ['required', 'confirmed', Password::min(8)->letters()->numbers()],
            'password_confirmation' => ['required', 'string'],
            'role'           => ['required', 'string', 'in:admin,member,publisher'],
            'band_member_id' => ['nullable', 'integer', 'exists:band_members,id'],
        ]);

        $user = User::create($data);

        return response()->json($this->format($user->load('bandMember')), 201);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'first_name'     => ['sometimes', 'required', 'string', 'max:100'],
            'last_name'      => ['sometimes', 'required', 'string', 'max:100'],
            'email'          => ['sometimes', 'required', 'email:rfc', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'password'       => ['sometimes', 'confirmed', Password::min(8)->letters()->numbers()],
            'password_confirmation' => ['sometimes', 'required_with:password', 'string'],
            'role'           => ['sometimes', 'required', 'string', 'in:admin,member,publisher'],
            'band_member_id' => ['nullable', 'integer', 'exists:band_members,id'],
        ]);

        $user->update($data);

        return response()->json($this->format($user->fresh('bandMember')));
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        if ($request->user()->id === $user->id) {
            return response()->json(['message' => 'You cannot delete your own account.'], 422);
        }

        $user->delete();

        return response()->json(null, 204);
    }

    private function format(User $user): array
    {
        return [
            'id'             => $user->id,
            'first_name'     => $user->first_name,
            'last_name'      => $user->last_name,
            'email'          => $user->email,
            'role'           => $user->role,
            'band_member_id' => $user->band_member_id,
            'band_member'    => $user->bandMember ? [
                'id'         => $user->bandMember->id,
                'first_name' => $user->bandMember->first_name,
                'last_name'  => $user->bandMember->last_name,
            ] : null,
            'created_at'     => $user->created_at,
            'updated_at'     => $user->updated_at,
        ];
    }
}
