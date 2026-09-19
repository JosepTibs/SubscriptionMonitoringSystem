import StatusBadge from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import AppLayout from '@/layouts/app-layout';
import { formatDate, formatPeso } from '@/lib/format';
import { type BreadcrumbItem, type Subscription } from '@/types';
import { Head, Link } from '@inertiajs/react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Subscriptions', href: '/subscriptions' },
];

function daysRemainingLabel(subscription: Subscription): { text: string; className: string } {
    const days = subscription.days_until_renewal;

    if (days === undefined || days === null) {
        return { text: '—', className: '' };
    }

    if (subscription.status === 'cancelled') {
        return { text: '—', className: 'text-muted-foreground' };
    }

    if (days < 0) {
        return { text: `${Math.abs(days)} days overdue`, className: 'text-destructive font-medium' };
    }

    if (days <= 30) {
        return { text: `${days} days`, className: 'text-destructive font-medium' };
    }

    return { text: `${days} days`, className: '' };
}

export default function SubscriptionsIndex({ subscriptions }: { subscriptions: Subscription[] }) {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Subscriptions" />

            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-semibold">Subscriptions</h1>
                        <p className="text-muted-foreground text-sm">All subscriptions managed by the ICT department.</p>
                    </div>

                    <Link href={route('subscriptions.create')}>
                        <Button>New Subscription</Button>
                    </Link>
                </div>

                <Card className="overflow-x-auto py-0">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-muted-foreground border-b text-left">
                                <th className="px-4 py-3 font-medium">Name</th>
                                <th className="px-4 py-3 font-medium">Provider</th>
                                <th className="px-4 py-3 font-medium">Office</th>
                                <th className="px-4 py-3 font-medium">Cost</th>
                                <th className="px-4 py-3 font-medium">Next renewal</th>
                                <th className="px-4 py-3 font-medium">Status</th>
                                <th className="px-4 py-3 font-medium">Days remaining</th>
                            </tr>
                        </thead>
                        <tbody>
                            {subscriptions.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="text-muted-foreground px-4 py-10 text-center">
                                        No subscriptions yet. Create the first one.
                                    </td>
                                </tr>
                            )}

                            {subscriptions.map((subscription) => {
                                const remaining = daysRemainingLabel(subscription);

                                return (
                                    <tr key={subscription.id} className="hover:bg-muted/50 border-b transition-colors last:border-0">
                                        <td className="px-4 py-3">
                                            <Link href={route('subscriptions.show', subscription.id)} className="font-medium hover:underline">
                                                {subscription.name}
                                            </Link>
                                        </td>
                                        <td className="px-4 py-3">{subscription.provider}</td>
                                        <td className="px-4 py-3">{subscription.office?.name ?? '—'}</td>
                                        <td className="px-4 py-3">{formatPeso(subscription.cost)}</td>
                                        <td className="px-4 py-3">{formatDate(subscription.renewal_date)}</td>
                                        <td className="px-4 py-3">
                                            <StatusBadge status={subscription.status} />
                                        </td>
                                        <td className={`px-4 py-3 ${remaining.className}`}>{remaining.text}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </Card>
            </div>
        </AppLayout>
    );
}
