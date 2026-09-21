<?php

namespace App\Http\Controllers;

use App\Models\Model_has_roles;
use App\Models\Roles;
use App\Models\User;
use App\Services\AuditTrail;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class UserController extends Controller
{
    public function index(Request $request)
    {
        $search = $request->input('search');
        $roleFilter = $request->input('role');

        $users = User::query()
            ->with('roles')
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($user) {
                return [
                    'id' => $user->id,
                    'username' => $user->username,
                    'fname' => $user->fname,
                    'mname' => $user->mname,
                    'lname' => $user->lname,
                    'sname' => $user->sname,
                    'email' => $user->email,
                    'email_verified_at' => $user->email_verified_at,
                    'role' => $user->roles->first()?->only(['id', 'name']),
                    'created_at' => $user->created_at->format('Y-m-d'),
                ];
            });

        $allRoles = Roles::all(['id', 'name']);

        return Inertia::render('users/index', [
            'users' => $users,
            'roles' => $allRoles,
            'filters' => [
                'search' => $search,
                'role' => $roleFilter,
            ],
        ]);
    }

    public function create()
    {
        $allRoles = $this->assignableRoles();

        return Inertia::render('users/create', [
            'roles' => $allRoles,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'username' => 'required|string|max:255',
            'fname' => 'required|string|max:255',
            'mname' => 'nullable|string|max:255',
            'lname' => 'required|string|max:255',
            'sname' => 'nullable|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:8|confirmed',
            'role_id' => 'required|exists:roles,id',
        ]);

        $this->validateRoleAssignment($validated);

        $user = User::create([
            'username' => $validated['username'],
            'fname' => $validated['fname'],
            'mname' => $validated['mname'],
            'lname' => $validated['lname'],
            'sname' => $validated['sname'],
            'email' => $validated['email'],
            'password' => bcrypt($validated['password']),
            'email_verified_at' => now(),
        ]);

        $this->syncRole($user, (int) $validated['role_id']);

        AuditTrail::record(
            user: $request->user(),
            action: 'User Created',
            auditable: $user,
            newValues: collect($validated)->except('password')->all(),
            description: 'Created user "'.$user->username.'"',
        );

        return redirect()->route('users.index')->with('success', 'User created successfully.');
    }

    public function show(User $user)
    {
        $user->load('roles');

        return Inertia::render('users/show', [
            'user' => [
                'id' => $user->id,
                'username' => $user->username,
                'fname' => $user->fname,
                'mname' => $user->mname,
                'lname' => $user->lname,
                'sname' => $user->sname,
                'email' => $user->email,
                'role' => $user->roles->first()?->only(['id', 'name']),
                'role_id' => $user->roles->first()?->id,
                'created_at' => $user->created_at->format('Y-m-d'),

            ],
            // Roles available to the edit sheet (same rules as the edit page).
            'roles' => $this->assignableRoles(),
        ]);
    }

    public function edit(User $user)
    {
        $user->load('roles');
        $allRoles = $this->assignableRoles();

        return Inertia::render('users/edit', [
            'user' => [
                'id' => $user->id,
                'username' => $user->username,
                'fname' => $user->fname,
                'mname' => $user->mname,
                'lname' => $user->lname,
                'sname' => $user->sname,
                'email' => $user->email,
                'role_id' => $user->roles->first()?->id,
            ],
            'roles' => $allRoles,
        ]);
    }

    public function update(Request $request, User $user)
    {
        $validated = $request->validate([
            'username' => 'required|string|max:255',
            'fname' => 'required|string|max:255',
            'mname' => 'nullable|string|max:255',
            'lname' => 'required|string|max:255',
            'sname' => 'nullable|string|max:255',
            'email' => ['required', 'string', 'email', 'max:255', Rule::unique('users')->ignore($user->id)],
            'password' => 'nullable|string|min:8|confirmed',
            'role_id' => 'required|exists:roles,id',
        ]);

        $this->validateRoleAssignment($validated);

        $oldRole = $user->roles->first()?->id;

        $user->update([
            'username' => $validated['username'],
            'fname' => $validated['fname'],
            'mname' => $validated['mname'],
            'lname' => $validated['lname'],
            'sname' => $validated['sname'],
            'email' => $validated['email'],
        ]);

        if (! empty($validated['password'])) {
            $user->update(['password' => bcrypt($validated['password'])]);
        }

        $this->syncRole($user, (int) $validated['role_id']);

        AuditTrail::record(
            user: $request->user(),
            action: 'User Updated',
            auditable: $user,
            oldValues: ['role_id' => $oldRole],
            newValues: collect($validated)->except('password')->merge(['role_id' => $validated['role_id']])->all(),
            description: 'Updated user "'.$user->username.'"',
        );

        return redirect()->route('users.index')->with('success', 'User updated successfully.');
    }

    /**
     * Roles the current user may assign. The Superadmin role can only be
     * granted by an existing Superadmin, preventing privilege escalation
     * through the regular Admin user-management screens.
     */
    private function assignableRoles()
    {
        $query = Roles::query();

        if (! auth()->user()?->hasRole('superadmin')) {
            $query->where('name', '!=', 'Superadmin');
        }

        return $query->get(['id', 'name']);
    }

    /**
     * Reject role assignments that escalate beyond the current user's rights.
     */
    private function validateRoleAssignment(array $validated)
    {
        $role = Roles::find($validated['role_id'] ?? null);

        if ($role && strtolower($role->name) === 'superadmin' && ! auth()->user()?->hasRole('superadmin')) {
            abort(403, 'Only a Superadmin can assign the Superadmin role.');
        }
    }

    /**
     * Write the user's role into the morph pivot table. Replaces any
     * existing role so a demotion actually takes effect.
     */
    private function syncRole(User $user, int $roleId): void
    {
        Model_has_roles::where('model_type', User::class)->where('model_id', $user->id)->delete();

        Model_has_roles::create([
            'role_id' => $roleId,
            'model_type' => User::class,
            'model_id' => $user->id,
        ]);

        $user->unsetRelation('roles');
    }

    public function destroy(User $user)
    {

        // Prevent deleting yourself
        if ($user->id === auth()->id()) {
            return redirect()->route('users.index')->with('error', 'You cannot delete your own account.');
        }

        // Prevent deleting an existing Superadmin
        if ($user->roles->contains(fn ($role) => strtolower($role->name) === 'superadmin')) {
            return redirect()->route('users.index')->with('error', 'You cannot delete a Superadmin account.');
        }

        $user->delete();

        return redirect()->route('users.index')->with('success', 'User deleted successfully.');
    }
}
