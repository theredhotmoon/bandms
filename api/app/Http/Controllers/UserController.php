<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class UserController extends Controller
{
    /**
     * Who may spend the assistant's tokens, and who decides. Only a superadmin
     * may send these; from anyone else they are a 403, not silently dropped,
     * so the admin cannot believe it saved a switch it did not.
     */
    private const SUPERADMIN_FIELDS = ['is_superadmin', 'can_translate', 'can_enhance'];

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
        if ($denied = $this->guardSuperadminFields($request)) {
            return $denied;
        }

        $data = $request->validate([
            'first_name'     => ['required', 'string', 'max:100'],
            'last_name'      => ['required', 'string', 'max:100'],
            'email'          => ['required', 'email:rfc', 'max:255', 'unique:users,email'],
            'password'       => ['required', 'confirmed', Password::min(8)->letters()->numbers()],
            'password_confirmation' => ['required', 'string'],
            'role'           => ['required', 'string', 'in:admin,member,publisher'],
            'band_member_id' => ['nullable', 'integer', 'exists:band_members,id'],
            ...$this->flagRules(),
        ]);

        if (($data['is_superadmin'] ?? false) && $data['role'] !== 'admin') {
            return $this->onlyAdminsMayBeSuperadmin();
        }

        $user = User::create($data);

        return response()->json($this->format($user->load('bandMember')), 201);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        if ($denied = $this->guardSuperadminFields($request) ?? $this->guardSuperadminTarget($request, $user)) {
            return $denied;
        }

        $data = $request->validate([
            'first_name'     => ['sometimes', 'required', 'string', 'max:100'],
            'last_name'      => ['sometimes', 'required', 'string', 'max:100'],
            'email'          => ['sometimes', 'required', 'email:rfc', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'password'       => ['sometimes', 'confirmed', Password::min(8)->letters()->numbers()],
            'password_confirmation' => ['sometimes', 'required_with:password', 'string'],
            'role'           => ['sometimes', 'required', 'string', 'in:admin,member,publisher'],
            'band_member_id' => ['nullable', 'integer', 'exists:band_members,id'],
            ...$this->flagRules(),
        ]);

        $role         = $data['role'] ?? $user->role;
        $willBeSuper  = array_key_exists('is_superadmin', $data) ? (bool) $data['is_superadmin'] : (bool) $user->is_superadmin;
        if ($willBeSuper && $role !== 'admin') {
            // Leaving `admin` while flagged is a demotion: they would lose the
            // Users page, so it is refused like any other demotion of the last
            // one — and refused outright when the flag is being granted.
            if (!$user->is_superadmin || array_key_exists('is_superadmin', $data)) {
                return $this->onlyAdminsMayBeSuperadmin();
            }
            $data['is_superadmin'] = $willBeSuper = false;
        }

        // Count and write under one lock, so two superadmins demoting each other
        // at the same moment cannot both pass the "at least one" check.
        return DB::transaction(function () use ($user, $data, $willBeSuper) {
            if ($user->is_superadmin && !$willBeSuper && $this->isLastSuperadmin($user)) {
                return $this->atLeastOneSuperadmin();
            }

            $user->update($data);

            return response()->json($this->format($user->fresh('bandMember')));
        });
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        if ($request->user()->id === $user->id) {
            return response()->json(['message' => 'You cannot delete your own account.'], 422);
        }
        if ($denied = $this->guardSuperadminTarget($request, $user)) {
            return $denied;
        }

        return DB::transaction(function () use ($user) {
            if ($this->isLastSuperadmin($user)) {
                return $this->atLeastOneSuperadmin();
            }

            $user->delete();

            return response()->json(null, 204);
        });
    }

    /**
     * A superadmin's account — password, email, role, existence — is a
     * superadmin's business only. Without this, a regular admin could reset a
     * superadmin's password and sign in as them, which is the whole gate.
     */
    private function guardSuperadminTarget(Request $request, User $user): ?JsonResponse
    {
        if ($user->is_superadmin && !$request->user()->is_superadmin) {
            return response()->json(['message' => 'Only a superadmin can change or delete a superadmin.'], 403);
        }

        return null;
    }

    private function onlyAdminsMayBeSuperadmin(): JsonResponse
    {
        return response()->json(['message' => 'Only an admin can be a superadmin.'], 422);
    }

    private function atLeastOneSuperadmin(): JsonResponse
    {
        return response()->json(['message' => 'There must always be at least one superadmin.'], 422);
    }

    /** @return array<string, array<int, string>> */
    private function flagRules(): array
    {
        return array_fill_keys(self::SUPERADMIN_FIELDS, ['sometimes', 'boolean']);
    }

    private function guardSuperadminFields(Request $request): ?JsonResponse
    {
        $sent = array_intersect(self::SUPERADMIN_FIELDS, array_keys($request->all()));
        if ($sent !== [] && !$request->user()->is_superadmin) {
            return response()->json(['message' => 'Only a superadmin can change assistant access or superadmin status.'], 403);
        }

        return null;
    }

    /** Superadmins who can actually act: admin role (others never reach /users). Locked for the caller's transaction. */
    private function isLastSuperadmin(User $user): bool
    {
        return $user->is_superadmin
            && User::where('is_superadmin', true)->where('role', 'admin')->lockForUpdate()->count() <= 1;
    }

    private function format(User $user): array
    {
        return [
            'id'             => $user->id,
            'first_name'     => $user->first_name,
            'last_name'      => $user->last_name,
            'email'          => $user->email,
            'role'           => $user->role,
            'is_superadmin'  => (bool) $user->is_superadmin,
            'can_translate'  => (bool) $user->can_translate,
            'can_enhance'    => (bool) $user->can_enhance,
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
