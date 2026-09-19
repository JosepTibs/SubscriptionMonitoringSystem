import { Head, Link, usePage } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Mail, Shield, LogIn, LogOut, AlertTriangle, Monitor } from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Dashboard',
        href: '/dashboard',
    },
    {
        title: 'Profile',
        href: '/profile',
    },
];

interface Role {
    id: number;
    name: string;
}

interface ProfileUser {
    id: number;
    username: string;
    fname: string | null;
    mname: string | null;
    lname: string | null;
    sname: string | null;
    name: string;
    email: string;
    avatar: string | null;
    created_at: string;
    updated_at: string;
    email_verified_at: string | null;
    roles: Role[];
}

interface Activity {
    id: number;
    event: 'login' | 'logout' | 'failed';
    ip_address: string | null;
    user_agent: string | null;
    date: string;
    time: string;
}

interface ProfilePageProps extends Record<string, unknown> {
    user: ProfileUser;
    activities: Activity[];
}

function getInitials(name: string | undefined | null): string {
    if (!name) return '?';
    const names = name.trim().split(' ');
    if (names.length === 0) return '?';
    if (names.length === 1) return names[0].charAt(0).toUpperCase();
    return `${names[0].charAt(0)}${names[names.length - 1].charAt(0)}`.toUpperCase();
}

export default function Profile() {
    const { user, activities } = usePage<ProfilePageProps>().props;
    const displayName = user.name || user.username;
    const initials = getInitials(displayName);
    const failedActivities = activities.filter((activity) => activity.event === 'failed');
    const latestActivity = activities[0];
    const emailVerified = Boolean(user.email_verified_at);
    const profileComplete = Boolean(user.name && user.username && user.email && user.fname && user.lname);

    const getEventMeta = (event: Activity['event']) => {
        switch (event) {
            case 'login':
                return { label: 'Signed in', icon: LogIn, className: 'text-emerald-600 dark:text-emerald-400', dotClassName: 'bg-emerald-500' };
            case 'logout':
                return { label: 'Signed out', icon: LogOut, className: 'text-muted-foreground', dotClassName: 'bg-muted-foreground' };
            case 'failed':
                return { label: 'Failed sign-in', icon: AlertTriangle, className: 'text-destructive', dotClassName: 'bg-destructive' };
            default:
                return { label: event, icon: Monitor, className: 'text-muted-foreground', dotClassName: 'bg-muted-foreground' };
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Profile" />
            <div className="min-h-full bg-muted/20">
                <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">Account</p>
                        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Profile</h1>
                        <p className="text-sm text-muted-foreground">Manage your identity, access, and account security.</p>
                    </div>

                    <Card className="overflow-hidden">
                        <CardContent className="p-6 sm:p-8">
                            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex min-w-0 items-center gap-4 sm:gap-5">
                                    <Avatar className="h-20 w-20 shrink-0 sm:h-24 sm:w-24">
                                        <AvatarImage src={user.avatar ?? undefined} alt={displayName} />
                                        <AvatarFallback className="text-xl sm:text-2xl">{initials}</AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h2 className="truncate text-2xl font-semibold tracking-tight">{displayName}</h2>
                                            <Badge variant="outline" className="gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Active</Badge>
                                        </div>
                                        <p className="mt-1 text-sm text-muted-foreground">@{user.username}</p>
                                        <p className="mt-2 flex items-center gap-2 text-sm">
                                            <Mail className="h-4 w-4 text-muted-foreground" />
                                            <span className="truncate">{user.email}</span>
                                            {emailVerified && <span className="shrink-0 text-xs font-medium text-emerald-600 dark:text-emerald-400">Verified</span>}
                                        </p>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {user.roles.length > 0 ? user.roles.map((role) => <Badge key={role.id} variant="secondary">{role.name}</Badge>) : <Badge variant="outline">No role assigned</Badge>}
                                        </div>
                                    </div>
                                </div>
                                <Button asChild className="w-full shrink-0 sm:w-auto"><Link href={route('profile.edit')}>Edit profile</Link></Button>
                            </div>
                        </CardContent>
                    </Card>

                    <section className="space-y-3">
                        <div>
                            <h2 className="text-base font-semibold">Account health</h2>
                            <p className="text-sm text-muted-foreground">A quick overview of anything that may need your attention.</p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <HealthCard label="Email" value={emailVerified ? 'Verified' : 'Not verified'} ok={emailVerified} />
                            <HealthCard label="Profile" value={profileComplete ? 'Complete' : 'Needs attention'} ok={profileComplete} />
                            <HealthCard label="Access" value={`${user.roles.length} ${user.roles.length === 1 ? 'role' : 'roles'}`} ok={user.roles.length > 0} />
                            <HealthCard label="Security" value={failedActivities.length ? `${failedActivities.length} failed attempt${failedActivities.length === 1 ? '' : 's'}` : 'No issues detected'} ok={failedActivities.length === 0} />
                        </div>
                    </section>

                    <section className="grid gap-4 lg:grid-cols-2">
                        <Card>
                            <CardHeader><CardTitle className="text-base">Personal information</CardTitle></CardHeader>
                            <CardContent>
                                <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
                                    <Detail label="Full name" value={user.name || 'Not provided'} />
                                    <Detail label="Username" value={`@${user.username}`} />
                                    <Detail label="Email" value={user.email} />
                                    <Detail label="Email status" value={emailVerified ? 'Verified' : 'Not verified'} valueClassName={emailVerified ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'} />
                                </dl>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader><CardTitle className="text-base">Access</CardTitle></CardHeader>
                            <CardContent>
                                {user.roles.length > 0 ? (
                                    <div className="space-y-4">
                                        <p className="text-sm text-muted-foreground">You currently have {user.roles.length} assigned {user.roles.length === 1 ? 'role' : 'roles'}.</p>
                                        <div className="flex flex-wrap gap-2">
                                            {user.roles.map((role) => <Badge key={role.id} variant="secondary" className="px-3 py-1"><Shield className="mr-1.5 h-3.5 w-3.5" />{role.name}</Badge>)}
                                        </div>
                                    </div>
                                ) : <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No roles are currently assigned to this account.</div>}
                            </CardContent>
                        </Card>
                    </section>

                    <Card>
                        <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <CardTitle className="text-base">Recent security activity</CardTitle>
                                <p className="mt-1 text-sm text-muted-foreground">Recent sign-in activity associated with your account.</p>
                            </div>
                            {failedActivities.length > 0 && <Badge variant="destructive" className="w-fit">{failedActivities.length} failed attempt{failedActivities.length === 1 ? '' : 's'}</Badge>}
                        </CardHeader>
                        <CardContent>
                            {activities.length === 0 ? (
                                <div className="rounded-lg border border-dashed p-8 text-center">
                                    <Monitor className="mx-auto h-8 w-8 text-muted-foreground" />
                                    <p className="mt-3 text-sm font-medium">No activity recorded yet</p>
                                    <p className="mt-1 text-sm text-muted-foreground">Sign-in activity will appear here when available.</p>
                                </div>
                            ) : (
                                <div className="divide-y rounded-lg border">
                                    {activities.slice(0, 8).map((activity) => {
                                        const meta = getEventMeta(activity.event);
                                        const Icon = meta.icon;
                                        return (
                                            <div key={activity.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                                                <div className="flex min-w-0 items-start gap-3">
                                                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted"><Icon className={`h-4 w-4 ${meta.className}`} /></div>
                                                    <div className="min-w-0">
                                                        <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium">{meta.label}</p><span className={`h-1.5 w-1.5 rounded-full ${meta.dotClassName}`} /></div>
                                                        <p className="mt-1 truncate text-xs text-muted-foreground">{activity.user_agent ?? 'Unknown device'}</p>
                                                        <p className="mt-0.5 text-xs text-muted-foreground">IP {activity.ip_address ?? 'Unknown'}</p>
                                                    </div>
                                                </div>
                                                <div className="shrink-0 text-left sm:text-right"><p className="text-xs font-medium">{activity.date}</p><p className="text-xs text-muted-foreground">{activity.time}</p></div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <div className="flex flex-col gap-2 border-t pt-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-wrap gap-x-4 gap-y-1"><span>Account created {user.created_at}</span><span>Last updated {user.updated_at}</span></div>
                        {latestActivity && <span>Last activity {latestActivity.date} at {latestActivity.time}</span>}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}

function HealthCard({ label, value, ok }: { label: string; value: string; ok: boolean }) {
    return (
        <Card>
            <CardContent className="flex items-start gap-3 p-4">
                <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${ok ? 'bg-emerald-500/10' : 'bg-amber-500/10'}`}>
                    <span className={`h-2.5 w-2.5 rounded-full ${ok ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                </div>
                <div className="min-w-0"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>
            </CardContent>
        </Card>
    );
}

function Detail({ label, value, valueClassName = '' }: { label: string; value: string; valueClassName?: string }) {
    return <div className="min-w-0"><dt className="text-xs font-medium text-muted-foreground">{label}</dt><dd className={`mt-1 truncate text-sm font-medium ${valueClassName}`}>{value}</dd></div>;
}