import StatusBadge from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AppLayout from '@/layouts/app-layout';
import { formatDate, formatPeso } from '@/lib/format';
import { type BreadcrumbItem, type Subscription } from '@/types';
import { Head, Link } from '@inertiajs/react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Dashboard',
        href: '/dashboard',
    },
];

interface DashboardStats {
    active: number;
    expiring_soon: number;
    overdue: number;
    total_cost: string;
}

function daysLabel(subscription: Subscription): { text: string; className: string } {
    const days = subscription.days_until_renewal;

    if (days === undefined || days === null) {
        return { text: '—', className: '' };
    }

    if (days < 0) {
        return { text: `${Math.abs(days)} days overdue`, className: 'text-destructive font-medium' };
    }

    if (days <= 30) {
        return { text: `${days} days`, className: 'text-destructive font-medium' };
    }

    return { text: `${days} days`, className: '' };
}

export default function Dashboard({ stats, dueSoon }: { stats: DashboardStats; dueSoon: Subscription[] }) {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Dashboard" />
            <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
                <div className="grid auto-rows-min gap-4 md:grid-cols-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-2xl font-bold">{stats.active}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Expiring 30 days</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-2xl font-bold">{stats.expiring_soon}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Overdue</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-2xl font-bold text-destructive">{stats.overdue}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Active spend</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-2xl font-bold">{formatPeso(stats.total_cost)}</p>
                        </CardContent>
                    </Card>
                </div>
                <Card className="py-0">
                    <CardHeader className="flex flex-row items-center justify-between py-4">
                        <CardTitle>Due soon</CardTitle>
                        <Link href={route('subscriptions.index')}>
                            <Button variant="outline" size="sm">
                                View all
                            </Button>
                        </Link>
                    </CardHeader>
                    <div className="overflow-x-auto px-0 pb-4">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b text-left text-muted-foreground">
                                    <th className="px-4 py-3 font-medium">Name</th>
                                    <th className="px-4 py-3 font-medium">Renewal</th>
                                    <th className="px-4 py-3 font-medium">Status</th>
                                    <th className="px-4 py-3 font-medium">Days</th>
                                </tr>
                            </thead>
                            <tbody>
                                {dueSoon.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                                            Nothing due in the next 30 days.
                                        </td>
                                    </tr>
                                )}
                                {dueSoon.map((sub) => {
                                    const r = daysLabel(sub);
                                    return (
                                        <tr key={sub.id} className="border-b transition-colors last:border-0 hover:bg-muted/50">
                                            <td className="px-4 py-3">
                                                <Link href={route('subscriptions.show', sub.id)} className="font-medium hover:underline">
                                                    {sub.name}
                                                </Link>
                                            </td>
                                            <td className="px-4 py-3">{formatDate(sub.renewal_date)}</td>
                                            <td className="px-4 py-3">
                                                <StatusBadge status={sub.status} />
                                            </td>
                                            <td className={`px-4 py-3 ${r.className}`}>{r.text}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
        </AppLayout>
    );
}
