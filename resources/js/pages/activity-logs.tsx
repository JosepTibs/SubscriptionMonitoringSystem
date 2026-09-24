import { Head, Link, usePage, router } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Monitor, User, Calendar, Filter } from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Dashboard',
        href: '/dashboard',
    },
    {
        title: 'Activity Logs',
        href: '/activity-logs',
    },
];

interface User {
    id: number;
    username: string;
    fname: string;
    lname: string;
}

interface ActivityLog {
    id: number;
    event: string;
    description: string | null;
    subject_type: string;
    ip_address: string | null;
    created_at: string;
    user: {
        id: number;
        username: string;
        fname: string;
        mname: string;
        lname: string;
        sname: string;
    } | null;
}

interface Filters {
    user_id: string;
    event: string;
    subject_type: string;
    date_from: string;
    date_to: string;
    search: string;
}

interface ActivityLogsPageProps extends Record<string, unknown> {
    activities: {
        data: ActivityLog[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
        links: Array<{
            url: string | null;
            label: string;
            active: boolean;
        }>;
    };
    users: User[];
    eventTypes: string[];
    subjectTypes: string[];
    filters: Filters;
}

export default function ActivityLogs() {
    const { activities, users, eventTypes, filters } = usePage<ActivityLogsPageProps>().props;
    const [showFilters, setShowFilters] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedActivity, setSelectedActivity] = useState<ActivityLog | null>(null);

    const [search, setSearch] = useState(filters.search || '');
    const [userId, setUserId] = useState(
        filters.user_id && filters.user_id !== 'all' ? filters.user_id : ''
    );
    const [event, setEvent] = useState(
        filters.event && filters.event !== 'all' ? filters.event : ''
    );
    const [dateFrom, setDateFrom] = useState(filters.date_from || '');
    const [dateTo, setDateTo] = useState(filters.date_to || '');

    const activeFilterCount = [search, userId, event, dateFrom, dateTo].filter(Boolean).length;

    const applyFilters = (overrides: Record<string, string | number | undefined> = {}) => {
        const params: Record<string, string | number> = {
            ...(search ? { search } : {}),
            ...(userId ? { user_id: userId } : {}),
            ...(event ? { event } : {}),
            ...(dateFrom ? { date_from: dateFrom } : {}),
            ...(dateTo ? { date_to: dateTo } : {}),
            ...Object.fromEntries(
                Object.entries(overrides).filter(([, value]) => value !== undefined && value !== '')
            ),
        };

        setIsLoading(true);

        router.get('/activity-logs', params, {
            only: ['activities'],
            preserveState: true,
            preserveScroll: true,
            replace: true,
            onFinish: () => setIsLoading(false),
        });
    };

    const clearFilters = () => {
        setSearch('');
        setUserId('');
        setEvent('');
        setDateFrom('');
        setDateTo('');

        setIsLoading(true);

        router.get('/activity-logs', {}, {
            only: ['activities'],
            preserveState: true,
            preserveScroll: true,
            replace: true,
            onFinish: () => setIsLoading(false),
        });
    };

    const getEventBadge = (event: string) => {
        switch (event.toLowerCase()) {
            case 'created':
                return {
                    label: 'Created',
                    variant: 'default' as const,
                    className: 'bg-emerald-600 text-white',
                };
            case 'updated':
                return {
                    label: 'Updated',
                    variant: 'default' as const,
                    className: 'bg-blue-600 text-white',
                };
            case 'deleted':
                return {
                    label: 'Deleted',
                    variant: 'destructive' as const,
                    className: '',
                };
            case 'login':
                return {
                    label: 'Login',
                    variant: 'outline' as const,
                    className: 'border-emerald-600 text-emerald-600',
                };
            case 'logout':
                return {
                    label: 'Logout',
                    variant: 'outline' as const,
                    className: '',
                };
            default:
                return {
                    label: event,
                    variant: 'secondary' as const,
                    className: '',
                };
        }
    };

    const getInitials = (name: string | undefined | null): string => {
        if (!name) return '?';

        const names = name.trim().split(/\s+/);

        if (names.length === 1) {
            return names[0].charAt(0).toUpperCase();
        }

        return `${names[0].charAt(0)}${names[names.length - 1].charAt(0)}`.toUpperCase();
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const formatTime = (dateString: string) => {
        return new Date(dateString).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Activity Logs" />

            <div className="min-h-full bg-muted/20">
                <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-4 sm:p-6 lg:p-8">
                    {/* Header */}
                    <div className="flex flex-col gap-1">
                        <p className="text-sm font-medium text-muted-foreground">Security & Audit</p>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                                    Activity Logs
                                </h1>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Review actions and sign-in activity across your system.
                                </p>
                            </div>

                            <div className="text-sm text-muted-foreground">
                                {activities.total.toLocaleString()} total events
                            </div>
                        </div>
                    </div>

                    {/* Search + filters */}
                    <Card>
                        <CardContent className="p-4">
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    applyFilters({ page: 1 });
                                }}
                                className="flex flex-col gap-3 lg:flex-row"
                            >
                                <div className="relative min-w-0 flex-1">
                                    <Input
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        placeholder="Search activity..."
                                        className="h-10"
                                    />
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    <Select
                                        value={event || 'all'}
                                        onValueChange={(value) => setEvent(value === 'all' ? '' : value)}
                                    >
                                        <SelectTrigger className="w-full sm:w-40">
                                            <SelectValue placeholder="All events" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All events</SelectItem>
                                            {eventTypes.map((type) => (
                                                <SelectItem key={type} value={type}>
                                                    {type.charAt(0).toUpperCase() + type.slice(1)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>

                                    <Select
                                        value={userId || 'all'}
                                        onValueChange={(value) => setUserId(value === 'all' ? '' : value)}
                                    >
                                        <SelectTrigger className="w-full sm:w-44">
                                            <SelectValue placeholder="All users" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All users</SelectItem>
                                            {users.map((u) => (
                                                <SelectItem key={u.id} value={String(u.id)}>
                                                    {u.fname} {u.lname} (@{u.username})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>

                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setShowFilters((value) => !value)}
                                        className="gap-2"
                                    >
                                        <Filter className="h-4 w-4" />
                                        More filters
                                        {activeFilterCount > 0 && (
                                            <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                                                {activeFilterCount}
                                            </span>
                                        )}
                                    </Button>

                                    <Button type="submit" className="w-full sm:w-auto">
                                        Search
                                    </Button>
                                </div>
                            </form>

                            {showFilters && (
                                <div className="mt-4 border-t pt-4">
                                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                        <div className="space-y-2">
                                            <Label htmlFor="date_from">From</Label>
                                            <Input
                                                id="date_from"
                                                type="date"
                                                value={dateFrom}
                                                onChange={(e) => setDateFrom(e.target.value)}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="date_to">To</Label>
                                            <Input
                                                id="date_to"
                                                type="date"
                                                value={dateTo}
                                                onChange={(e) => setDateTo(e.target.value)}
                                            />
                                        </div>

                                        <div className="flex items-end">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                onClick={clearFilters}
                                                disabled={activeFilterCount === 0}
                                            >
                                                Clear filters
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Data table */}
                    <Card className="overflow-hidden">
                        <CardHeader className="border-b">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <CardTitle className="text-base">Audit trail</CardTitle>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        Select an entry to inspect its details.
                                    </p>
                                </div>

                                {isLoading && (
                                    <span className="text-sm text-muted-foreground">Updating…</span>
                                )}
                            </div>
                        </CardHeader>

                        <CardContent className="p-0">
                            {activities.data.length === 0 ? (
                                <div className="px-6 py-14 text-center">
                                    <Monitor className="mx-auto h-8 w-8 text-muted-foreground" />
                                    <h3 className="mt-3 text-sm font-medium">No activity found</h3>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        Try changing your search or filters.
                                    </p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[760px] text-sm">
                                        <thead className="bg-muted/40">
                                            <tr className="border-b text-left text-muted-foreground">
                                                <th className="px-4 py-3 font-medium">User</th>
                                                <th className="px-4 py-3 font-medium">Event</th>
                                                <th className="px-4 py-3 font-medium">Description</th>
                                                <th className="px-4 py-3 font-medium">Resource</th>
                                                <th className="px-4 py-3 text-right font-medium">Date</th>
                                            </tr>
                                        </thead>

                                        <tbody className="divide-y">
                                            {activities.data.map((activity) => {
                                                const badge = getEventBadge(activity.event);

                                                return (
                                                    <tr
                                                        key={activity.id}
                                                        tabIndex={0}
                                                        role="button"
                                                        onClick={() => setSelectedActivity(activity)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' || e.key === ' ') {
                                                                e.preventDefault();
                                                                setSelectedActivity(activity);
                                                            }
                                                        }}
                                                        className="cursor-pointer transition-colors hover:bg-muted/40 focus:bg-muted/40 focus:outline-none"
                                                    >
                                                        <td className="px-4 py-3">
                                                            {activity.user ? (
                                                                <div className="flex items-center gap-3">
                                                                    <Avatar className="h-8 w-8">
                                                                        <AvatarFallback className="text-xs">
                                                                            {getInitials(
                                                                                `${activity.user.fname} ${activity.user.lname}`
                                                                            )}
                                                                        </AvatarFallback>
                                                                    </Avatar>
                                                                    <div className="min-w-0">
                                                                        <p className="font-medium">
                                                                            {activity.user.fname} {activity.user.lname}
                                                                        </p>
                                                                        <p className="text-xs text-muted-foreground">
                                                                            @{activity.user.username}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <span className="text-muted-foreground">System</span>
                                                            )}
                                                        </td>

                                                        <td className="px-4 py-3">
                                                            <Badge variant={badge.variant} className={badge.className}>
                                                                {badge.label}
                                                            </Badge>
                                                        </td>

                                                        <td className="max-w-[420px] px-4 py-3">
                                                            <p
                                                                className="truncate"
                                                                title={activity.description || undefined}
                                                            >
                                                                {activity.description || '—'}
                                                            </p>
                                                        </td>

                                                        <td className="px-4 py-3">
                                                            <code className="rounded bg-muted px-2 py-1 text-xs">
                                                                {activity.subject_type || '—'}
                                                            </code>
                                                        </td>

                                                        <td className="px-4 py-3 text-right whitespace-nowrap">
                                                            <p className="text-xs font-medium">
                                                                {formatDate(activity.created_at)}
                                                            </p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {formatTime(activity.created_at)}
                                                            </p>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Pagination */}
                            {activities.last_page > 1 && (
                                <div className="flex flex-col gap-3 border-t px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                                    <p className="text-sm text-muted-foreground">
                                        Showing{' '}
                                        {((activities.current_page - 1) * activities.per_page) + 1}
                                        {' '}to{' '}
                                        {Math.min(
                                            activities.current_page * activities.per_page,
                                            activities.total
                                        )}{' '}
                                        of {activities.total.toLocaleString()}
                                    </p>

                                    <div className="flex flex-wrap items-center gap-1">
                                        {activities.links.map((link, index) => (
                                            <Link
                                                key={index}
                                                href={link.url || '#'}
                                                preserveState
                                                preserveScroll
                                                only={['activities']}
                                                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                                                    link.active
                                                        ? 'bg-primary text-primary-foreground'
                                                        : 'bg-muted hover:bg-muted/80'
                                                } ${
                                                    !link.url
                                                        ? 'pointer-events-none opacity-40'
                                                        : ''
                                                }`}
                                                dangerouslySetInnerHTML={{ __html: link.label }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Activity details */}
            {selectedActivity && (
                <ActivityDetails
                    activity={selectedActivity}
                    onClose={() => setSelectedActivity(null)}
                    getInitials={getInitials}
                    formatDate={formatDate}
                    formatTime={formatTime}
                    getEventBadge={getEventBadge}
                />
            )}
        </AppLayout>
    );
}

function ActivityDetails({
    activity,
    onClose,
    getInitials,
    formatDate,
    formatTime,
    getEventBadge,
}: {
    activity: ActivityLog;
    onClose: () => void;
    getInitials: (name: string | undefined | null) => string;
    formatDate: (date: string) => string;
    formatTime: (date: string) => string;
    getEventBadge: (event: string) => {
        label: string;
        variant: 'default' | 'outline' | 'destructive' | 'secondary';
        className: string;
    };
}) {
    const badge = getEventBadge(activity.event);

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <button
                type="button"
                aria-label="Close activity details"
                className="absolute inset-0 bg-black/30 backdrop-blur-[1px]"
                onClick={onClose}
            />

            <aside
                className="relative h-full w-full max-w-lg overflow-y-auto border-l bg-background shadow-xl"
                role="dialog"
                aria-modal="true"
                aria-label="Activity details"
            >
                <div className="sticky top-0 z-10 border-b bg-background/95 px-6 py-5 backdrop-blur">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-sm text-muted-foreground">Activity details</p>
                            <h2 className="mt-1 text-xl font-semibold">Audit event</h2>
                        </div>

                        <Button variant="ghost" size="sm" onClick={onClose}>
                            Close
                        </Button>
                    </div>
                </div>

                <div className="space-y-6 p-6">
                    <div className="flex items-center gap-3">
                        <Badge variant={badge.variant} className={badge.className}>
                            {badge.label}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                            {formatDate(activity.created_at)} · {formatTime(activity.created_at)}
                        </span>
                    </div>

                    <section className="space-y-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            User
                        </p>

                        {activity.user ? (
                            <div className="flex items-center gap-3 rounded-lg border p-4">
                                <Avatar className="h-10 w-10">
                                    <AvatarFallback>
                                        {getInitials(
                                            `${activity.user.fname} ${activity.user.lname}`
                                        )}
                                    </AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="font-medium">
                                        {activity.user.fname} {activity.user.lname}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        @{activity.user.username}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                                System activity
                            </div>
                        )}
                    </section>

                    <section className="space-y-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Description
                        </p>
                        <div className="rounded-lg border bg-muted/20 p-4 text-sm">
                            {activity.description || 'No description provided.'}
                        </div>
                    </section>

                    <section className="grid gap-4 sm:grid-cols-2">
                        <Detail label="Resource" value={activity.subject_type || '—'} />
                        <Detail label="IP address" value={activity.ip_address || 'Unknown'} />
                        <Detail label="Date" value={formatDate(activity.created_at)} />
                        <Detail label="Time" value={formatTime(activity.created_at)} />
                    </section>
                </div>
            </aside>
        </div>
    );
}

function Detail({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="mt-1 text-sm font-medium break-words">{value}</p>
        </div>
    );
}