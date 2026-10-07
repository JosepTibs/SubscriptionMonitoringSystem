import { confirmRequest } from '@/components/confirm-dialog';
import CreateSubscriptionSheet from '@/components/create-subscription-sheet';
import StatusBadge from '@/components/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { formatDate, formatPeso } from '@/lib/format';
import { type ApprovalFlow, type BreadcrumbItem, type Owner, type SharedData, type Subscription } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { Archive, ArchiveRestore, Trash2, Eye, Search, ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Subscriptions', href: '/subscriptions' },
];

const allValue = 'all';

type SortKey = 'name' | 'provider' | 'cost' | 'renewal_date';
type SortDirection = 'asc' | 'desc';


/**
 * One value per sort key: strings compare with locale, cost is numeric
 * (decimal casts arrive as strings) and renewal dates are ISO strings.
 */
function sortValue(subscription: Subscription, key: SortKey): string | number {
    switch (key) {
        case 'cost':
            return Number(subscription.cost);
        default:
            return subscription[key] ?? '';
    }
}

/**
 * Client-side row sort. Subscriptions still travelling a chain carry no
 * renewal date; those sink to the bottom in both directions, matching the
 * server-side `renewal_date IS NULL` ordering.
 */
function compareSubscriptions(a: Subscription, b: Subscription, key: SortKey, direction: SortDirection): number {
    const aValue = sortValue(a, key);
    const bValue = sortValue(b, key);

    if (aValue === null || aValue === undefined || aValue === '') {
        return aValue === bValue ? 0 : 1;
    }

    if (bValue === null || bValue === undefined || bValue === '') {
        return -1;
    }

    const base =
        typeof aValue === 'number' && typeof bValue === 'number'
            ? aValue - bValue
            : String(aValue).localeCompare(String(bValue), undefined, { sensitivity: 'base' });

    return direction === 'asc' ? base : -base;
}

function daysRemainingLabel(subscription: Subscription): { text: string; className: string } {
    const days = subscription.days_until_renewal;

    if (days === undefined || days === null) {
        return { text: 'Not yet -', className: '' };
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

/**
 * Display-only overdue rule: an active subscription whose renewal date has
 * passed shows the Expired badge. The stored status stays `active` until
 * someone changes it (per the no-auto-expire rule), so this must never be
 * used where the real status decides behaviour.
 */
function displayStatus(subscription: Subscription): string {
    if (subscription.status === 'active' && subscription.renewal_date) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (new Date(subscription.renewal_date) < today) {
            return 'expired';
        }
    }

    return subscription.status;
}

export default function SubscriptionsIndex({
    subscriptions,
    subscription_count,
    owners,
    approval_flows,
    filters,
}: {
    subscriptions: Subscription[];
    subscription_count: number;
    owners: Owner[];
    approval_flows: ApprovalFlow[];
    filters: { show: string; search?: string; status?: string; due?: string; owner_id?: string };
}) {
    const { auth } = usePage<SharedData>().props;
    const canManage = auth.can_manage_records;
    const show = filters.show === 'archived' ? 'archived' : 'active';

    const [search, setSearch] = useState(filters.search ?? '');
    const [status, setStatus] = useState(filters.status && filters.status !== allValue ? filters.status : allValue);
    const [due, setDue] = useState(filters.due && filters.due !== allValue ? filters.due : allValue);
    const [ownerId, setOwnerId] = useState(filters.owner_id && filters.owner_id !== allValue ? String(filters.owner_id) : allValue);

    // Matches the server-side default ordering until a header is clicked.
    const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({ key: 'renewal_date', direction: 'asc' });

    /** Clicking the active header flips its direction; a new header starts ascending. */
    const toggleSort = (key: SortKey) =>
        setSort((previous) => ({
            key,
            direction: previous.key === key && previous.direction === 'asc' ? 'desc' : 'asc',
        }));

    const sorted = useMemo(
        () => [...subscriptions].sort((a, b) => compareSubscriptions(a, b, sort.key, sort.direction)),
        [subscriptions, sort],
    );

    /**
     * Navigate with the filters as they will be once this change is applied.
     *
     * The patch uses the state names - `search`, `status`, `due`, `ownerId` - so
     * it always overrides the value it replaces: the setters above have not
     * landed yet when this runs, and reading state alone would resend the value
     * being replaced (picking "All" would silently keep the previous filter
     * alive). The parameter is typed to those keys so a stray query name such
     * as `owner_id` cannot slip in and set a key nothing ever reads.
     */
    const applyFilters = (patch: Partial<Record<'search' | 'status' | 'due' | 'ownerId' | 'show', string>> = {}) => {
        const next = { search, status, due, ownerId, show: show === 'archived' ? 'archived' : allValue, ...patch };

        const params: Record<string, string> = {
            ...(next.search !== '' ? { search: next.search } : {}),
            ...(next.status !== '' && next.status !== allValue ? { status: next.status } : {}),
            ...(next.due !== '' && next.due !== allValue ? { due: next.due } : {}),
            ...(next.ownerId !== '' && next.ownerId !== allValue ? { owner_id: next.ownerId } : {}),
            ...(next.show === 'archived' ? { show: 'archived' } : {}),
        };

        router.get(route('subscriptions.index'), params, {
            only: ['subscriptions', 'filters'],
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    // Debounce the search box so each keystroke does not fire its own request.
    useEffect(() => {
        const trimmed = search.trim();
        const initial = (filters.search ?? '').trim();

        if (trimmed === initial) {
            return;
        }

        const timer = setTimeout(() => applyFilters({ search: trimmed }), 300);

        return () => clearTimeout(timer);
    }, [search]);

    const resetFilters = () => {
        setSearch('');
        setStatus(allValue);
        setDue(allValue);
        setOwnerId(allValue);

        router.get(
            route('subscriptions.index'),
            show === 'archived' ? { show: 'archived' } : {},
            { only: ['subscriptions', 'filters'], preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const hasActiveFilters =
        (filters.search ?? '') !== '' ||
        (filters.status !== undefined && filters.status !== allValue) ||
        (filters.due !== undefined && filters.due !== allValue) ||
        (filters.owner_id !== undefined && filters.owner_id !== allValue);

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
                        <Button
                            variant={show === 'archived' ? 'default' : 'outline'}
                            onClick={() =>
                                applyFilters({
                                    show: show === 'archived' ? allValue : 'archived',
                                })
                            }
                        >
                            {show === 'archived' ? 'Active' : 'Archived'}
                        </Button>
                        <CreateSubscriptionSheet mode="approved" owners={owners} approvalFlows={approval_flows} />
                    </div>
                </div>

                <Card>
                    <div className="flex flex-wrap items-center gap-2 p-4">
                        <div className="relative">
                            <Search className="text-muted-foreground absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2" />
                            <Input
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Search name or provider…"
                                aria-label="Search subscriptions"
                                className="w-56 pl-8"
                            />
                        </div>

                        <Select
                            value={status}
                            onValueChange={(value) => {
                                setStatus(value);
                                applyFilters({ status: value });
                            }}
                        >
                            <SelectTrigger className="w-40" aria-label="Status">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={allValue}>All statuses</SelectItem>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="expired">Expired</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                                <SelectItem value="suspended">Suspended</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select
                            value={due}
                            onValueChange={(value) => {
                                setDue(value);
                                applyFilters({ due: value });
                            }}
                        >
                            <SelectTrigger className="w-44" aria-label="Renewal window">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={allValue}>Any renewal date</SelectItem>
                                <SelectItem value="overdue">Overdue</SelectItem>
                                <SelectItem value="next_30">Next 30 days</SelectItem>
                                <SelectItem value="next_90">Next 90 days</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select
                            value={ownerId}
                            onValueChange={(value) => {
                                setOwnerId(value);
                                applyFilters({ ownerId: value });
                            }}
                        >
                            <SelectTrigger className="w-44" aria-label="Owner">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={allValue}>All owners</SelectItem>
                                {owners.map((owner) => (
                                    <SelectItem key={owner.id} value={String(owner.id)}>
                                        {owner.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {hasActiveFilters && (
                            <Button variant="ghost" onClick={resetFilters}>
                                Reset
                            </Button>
                        )}
                    </div>
                </Card>

                <Card className="overflow-x-auto py-0">
                    <h1 className="mt-6 mx-4 text-xl font-semibold">Subscription Count:  {subscription_count}</h1>
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-muted-foreground border-b text-left">
                                {(
                                    [
                                        { key: 'name', label: 'Name' },
                                        { key: 'provider', label: 'Provider' },
                                        { key: 'cost', label: 'Cost' },
                                        { key: 'renewal_date', label: 'Next renewal' },
                                    ] as { key: SortKey; label: string }[]
                                ).map(({ key, label }) => {
                                    const isSorted = sort.key === key;

                                    return (
                                        <th
                                            key={key}
                                            className="px-4 py-3 font-medium"
                                            aria-sort={isSorted ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}
                                        >
                                            <button
                                                type="button"
                                                className="hover:text-foreground flex items-center gap-1"
                                                onClick={() => toggleSort(key)}
                                            >
                                                {label}
                                                {isSorted ? (
                                                    sort.direction === 'asc' ? (
                                                        <ArrowUp className="h-3 w-3" />
                                                    ) : (
                                                        <ArrowDown className="h-3 w-3" />
                                                    )
                                                ) : (
                                                    <ArrowUpDown className="h-3 w-3 opacity-50" />
                                                )}
                                            </button>
                                        </th>
                                    );
                                })}
                                <th className="px-4 py-3 font-medium">Status</th>
                                <th className="px-4 py-3 font-medium">Days remaining</th>
                                <th className="px-4 py-3 text-right font-medium">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {subscriptions.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="text-muted-foreground px-4 py-10 text-center">
                                        {hasActiveFilters
                                            ? 'No subscriptions match the current filters.'
                                            : 'No subscriptions yet. Create the first one.'}
                                    </td>
                                </tr>
                            )}

                            {sorted.map((subscription) => {
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
                                                <StatusBadge status={displayStatus(subscription)} />
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
