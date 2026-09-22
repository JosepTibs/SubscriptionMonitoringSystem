<?php

namespace App\Http\Controllers;

use App\Models\activity_logs;
use App\Models\LoginActivity;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Inertia\Inertia;

class ActivityLogsController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        // Build query for general activity logs
        $generalQuery = activity_logs::with('user:id,username,fname,mname,lname,sname');

        // Filter by user (by username)
        if ($request->filled('user_id') && $request->user_id !== 'all') {
            $generalQuery->whereHas('user', function ($q) use ($request) {
                $q->where('username', $request->user_id);
            });
        }

        // Filter by event type
        if ($request->filled('event') && $request->event !== 'all') {
            $generalQuery->where('event', $request->event);
        }

        // Filter by subject type (model type)
        if ($request->filled('subject_type') && $request->subject_type !== 'all') {
            $generalQuery->where('subject_type', $request->subject_type);
        }

        // Filter by date range
        if ($request->filled('date_from')) {
            $generalQuery->whereDate('created_at', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $generalQuery->whereDate('created_at', '<=', $request->date_to);
        }

        // Search in description
        if ($request->filled('search')) {
            $search = $request->search;
            $generalQuery->where(function ($q) use ($search) {
                $q->where('description', 'like', "%{$search}%")
                    ->orWhere('subject_type', 'like', "%{$search}%");
            });
        }

        // Build query for login activities
        $loginQuery = LoginActivity::with('user:id,username,fname,mname,lname,sname');

        // Filter by user (by username)
        if ($request->filled('user_id') && $request->user_id !== 'all') {
            $loginQuery->whereHas('user', function ($q) use ($request) {
                $q->where('username', $request->user_id);
            });
        }

        // Filter by event type (login/logout)
        if ($request->filled('event') && $request->event !== 'all') {
            $loginQuery->where('event', $request->event);
        }

        // Filter by date range
        if ($request->filled('date_from')) {
            $loginQuery->whereDate('created_at', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $loginQuery->whereDate('created_at', '<=', $request->date_to);
        }

        // Search in event or user information
        if ($request->filled('search')) {
            $search = $request->search;
            $loginQuery->whereHas('user', function ($q) use ($search) {
                $q->where('username', 'like', "%{$search}%")
                    ->orWhere('fname', 'like', "%{$search}%")
                    ->orWhere('lname', 'like', "%{$search}%");
            })->orWhere('event', 'like', "%{$search}%");
        }

        // Fetch and normalize general activities (limit to recent 200 for performance)
        $generalActivities = $generalQuery
            ->orderByDesc('created_at')
            ->limit(200)
            ->get()
            ->map(function ($log) {
                $user = $log->user;

                return [
                    'id' => (string) $log->id,
                    'type' => 'general',
                    'event' => $log->event,
                    'user' => $user ? [
                        'id' => $user->id,
                        'username' => $user->username,
                        'fname' => $user->fname,
                        'mname' => $user->mname,
                        'lname' => $user->lname,
                        'sname' => $user->sname,
                    ] : null,
                    'user_name' => $user ? trim(implode(' ', array_filter([$user->fname, $user->mname, $user->lname, $user->sname]))) : 'Unknown',
                    'username' => $user?->username ?? 'unknown',
                    'ip_address' => $log->ip_address,
                    'user_agent' => $log->user_agent,
                    'description' => $log->description,
                    'subject_type' => $log->subject_type,
                    'properties' => $log->properties,
                    'created_at' => $log->created_at,
                ];
            });

        // Fetch and normalize login activities (limit to recent 200 for performance)
        $loginActivities = $loginQuery
            ->orderByDesc('created_at')
            ->limit(200)
            ->get()
            ->map(function ($activity) {
                $user = $activity->user;

                return [
                    'id' => 'login-'.$activity->id,
                    'type' => 'login',
                    'event' => $activity->event,
                    'user' => $user ? [
                        'id' => $user->id,
                        'username' => $user->username,
                        'fname' => $user->fname,
                        'mname' => $user->mname,
                        'lname' => $user->lname,
                        'sname' => $user->sname,
                    ] : null,
                    'user_name' => $user ? trim(implode(' ', array_filter([$user->fname, $user->mname, $user->lname, $user->sname]))) : 'Unknown',
                    'username' => $user?->username ?? 'unknown',
                    'ip_address' => $activity->ip_address,
                    'user_agent' => $activity->user_agent,
                    'description' => $activity->event === 'login' ? 'User logged in' : 'User logged out',
                    'subject_type' => null,
                    'properties' => null,
                    'created_at' => $activity->created_at,
                ];
            });

        // Merge and sort activities by date
        $mergedActivities = collect($generalActivities->all())
            ->merge($loginActivities)
            ->sortByDesc('created_at')
            ->values();

        // Manual pagination
        $perPage = 20;
        $currentPage = $request->input('page', 1);
        $total = $mergedActivities->count();
        $lastPage = max(1, (int) ceil($total / $perPage));
        $currentPage = min($currentPage, $lastPage);
        $offset = ($currentPage - 1) * $perPage;

        $paginatedActivities = new LengthAwarePaginator(
            $mergedActivities->slice($offset, $perPage)->values(),
            $total,
            $perPage,
            $currentPage,
            ['path' => $request->url(), 'query' => $request->query()]
        );

        // Get filter options
        $users = User::orderBy('username')->get(['id', 'username', 'fname', 'lname']);
        $generalEventTypes = activity_logs::select('event')->distinct()->pluck('event');
        $loginEventTypes = LoginActivity::select('event')->distinct()->pluck('event');
        $eventTypes = $generalEventTypes->merge($loginEventTypes)->unique()->values();
        $subjectTypes = activity_logs::select('subject_type')->distinct()->pluck('subject_type');

        return Inertia::render('activity-logs', [
            'activities' => $paginatedActivities,
            'users' => $users,
            'eventTypes' => $eventTypes,
            'subjectTypes' => $subjectTypes,
            'filters' => $request->only(['user_id', 'event', 'subject_type', 'date_from', 'date_to', 'search']),
        ]);
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        //
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        //
    }

    /**
     * Display the specified resource.
     */
    public function show(activity_logs $activity_logs)
    {
        //
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(activity_logs $activity_logs)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, activity_logs $activity_logs)
    {
        //
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(activity_logs $activity_logs)
    {
        //
    }
}
