<?php

namespace App\Http\Controllers;

use App\Models\LoginActivity;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ProfileController extends Controller
{
    /**
     * Display the user's profile page.
     */
    public function show(Request $request): Response
    {
        $user = $request->user()->load('roles');

        $activities = LoginActivity::where('user_id', $user->id)
            ->orderBy('created_at', 'desc')
            ->limit(10)
            ->get()
            ->map(fn ($activity) => [
                'id' => $activity->id,
                'event' => $activity->event,
                'ip_address' => $activity->ip_address,
                'user_agent' => $activity->user_agent,
                'date' => $activity->created_at?->format('M d, Y'),
                'time' => $activity->created_at?->format('g:i A'),
            ]);

        return Inertia::render('profile', [
            'user' => [
                'id' => $user->id,
                'username' => $user->username,
                'fname' => $user->fname,
                'mname' => $user->mname,
                'lname' => $user->lname,
                'sname' => $user->sname,
                'name' => $user->name,
                'email' => $user->email,
                'created_at' => $user->created_at?->format('F d, Y'),
                'updated_at' => $user->updated_at?->format('F d, Y g:i A'),
                'email_verified_at' => $user->email_verified_at?->format('F d, Y'),
                'roles' => $user->roles->map(fn ($role) => [
                    'id' => $role->id,
                    'name' => $role->name,
                ]),
            ],
            'activities' => $activities,
        ]);
    }
}
