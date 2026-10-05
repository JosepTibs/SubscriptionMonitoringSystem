import { confirmRequest } from '@/components/confirm-dialog';
import CreateSubscriptionSheet from '@/components/create-subscription-sheet';
import StatusBadge from '@/components/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { formatDate, formatPeso } from '@/lib/format';
import { type ApprovalFlow, type BreadcrumbItem, type Owner, type SharedData, type Subscription } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { Archive, ArchiveRestore, Trash2, Eye } from 'lucide-react';

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

export default function SubscriptionsIndex({
    subscriptions,
    owners,
    approval_flows,
    filters,
}: {
    subscriptions: Subscription[];
    owners: Owner[];
    approval_flows: ApprovalFlow[];
    filters: { show: string };
}) {
    const { auth } = usePage<SharedData>().props;
    const canManage = auth.can_manage_records;
    const show = filters.show === 'archived' ? 'archived' : 'active';

    async function handleArchive(subscription: Subscription) {
        const ok = await confirmRequest({
            title: `Archive "${subscription.name}"?`,
            description: 'It will be hidden from this list. You can bring it back from the Archived view.',
            confirmLabel: 'Archive',
            destructive: false,
        });

        if (ok) {
            router.patch(route('subscriptions.archive', subscription.id), {}, { preserveScroll: true });
        }
    }

    async function handleUnarchive(subscription: Subscription) {
        const ok = await confirmRequest({
            title: `Unarchive "${subscription.name}"?`,
            description: 'It will show in the active list again.',
            confirmLabel: 'Unarchive',
            destructive: false,
        });

        if (ok) {
            router.patch(route('subscriptions.unarchive', subscription.id), {}, { preserveScroll: true });
        }
    }

    async function handleDelete(subscription: Subscription) {
        const ok = await confirmRequest({
            title: `Delete "${subscription.name}"?`,
            description: 'This permanently removes the subscription with its renewals and approval history. This action cannot be undone.',
            confirmLabel: 'Delete subscription',
        });

        if (ok) {
            router.delete(route('subscriptions.destroy', subscription.id), { preserveScroll: true });
        }
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Subscriptions" />

            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-semibold">Subscriptions</h1>
                        <p className="text-muted-foreground text-sm">All subscriptions managed by the ICT department.</p>
                    </div>

                    <div className="flex items-center gap-2">
                        <Select
                            value={show}
                            onValueChange={(value) =>
                                router.get(route('subscriptions.index'), value === 'archived' ? { show: 'archived' } : {}, {
                                    preserveState: true,
                                    preserveScroll: true,
                                    replace: true,
                                })
                            }
                        >
                            <SelectTrigger className="w-36" aria-label="Archived filter">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="archived">Archived</SelectItem>
                            </SelectContent>
                        </Select>

                        <CreateSubscriptionSheet mode="approved" owners={owners} approvalFlows={approval_flows} />
                    </div>
                </div>

                <Card className="overflow-x-auto py-0">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-muted-foreground border-b text-left">
                                <th className="px-4 py-3 font-medium">Name</th>
                                <th className="px-4 py-3 font-medium">Provider</th>
                                <th className="px-4 py-3 font-medium">Cost</th>
                                <th className="px-4 py-3 font-medium">Next renewal</th>
                                <th className="px-4 py-3 font-medium">Status</th>
                                <th className="px-4 py-3 font-medium">Days remaining</th>
                                <th className="px-4 py-3 text-right font-medium">Actions</th>
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
                                        <td className="px-4 py-3">{formatPeso(subscription.cost)}</td>
                                        <td className="px-4 py-3">{formatDate(subscription.renewal_date)}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <StatusBadge status={subscription.status} />
                                                {show === 'archived' && <Badge variant="outline">Archived</Badge>}
                                            </div>
                                        </td>
                                        <td className={`px-4 py-3 ${remaining.className}`}>{remaining.text}</td>
                                        
                                            <td className="px-4 py-3">
                                                <div className="flex justify-end gap-2">
                                                    <Link href={route('subscriptions.show', subscription.id)} className="font-medium hover:underline">
                                                    <Button variant="outline" size="sm">
                                                    <Eye className="h-4 w-4" />
                                                    </Button>
                                                    </Link>
                                                    {canManage && (
                                                        <>
                                                    {show === 'archived' ? (
                                                        <Button variant="outline" size="sm" onClick={() => handleUnarchive(subscription)}>
                                                            <ArchiveRestore className="h-4 w-4" />
                                                        </Button>
                                                    ) : (
                                                        <Button variant="outline" size="sm" onClick={() => handleArchive(subscription)}>
                                                            <Archive className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="text-red-600 hover:text-red-700"
                                                        onClick={() => handleDelete(subscription)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                    </>
                                                    )}
                                                </div>
                                            </td>
                                        
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
