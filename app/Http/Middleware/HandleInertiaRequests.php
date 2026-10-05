<?php

namespace App\Http\Middleware;

use Illuminate\Foundation\Inspiring;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        [$message, $author] = str(Inspiring::quotes()->random())->explode('-');

        $user = $request->user();
        // Loaded once here so the role checks below and the serialized payload
        // do not each trigger their own lazy load of the relation.
        $user?->loadMissing('roles');

        return array_merge(parent::share($request), [
            ...parent::share($request),
            'name' => config('app.name'),
            'quote' => ['message' => trim($message), 'author' => trim($author)],
            'auth' => [
                'user' => $user,
                // Role names exactly as the roles table stores them - lowercase
                // - so a nav gate can compare like with like.
                'roles' => $user
                    ? $user->roles->pluck('name')->map(fn (string $name): string => strtolower($name))->values()->all()
                    : [],
                // The trail's edit affordances are decided separately from the
                // plain role names above, so both are shared.
                'can_edit_trail' => (bool) ($user?->hasRole('admin') || $user?->hasRole('superadmin')),
                // Archiving/deleting subscriptions, chains and users is gated
                // the same way; the pages hide those buttons without this.
                'can_manage_records' => (bool) ($user?->hasRole('admin') || $user?->hasRole('superadmin')),
            ],
        ]);
    }
}
