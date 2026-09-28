import Heading from '@/components/heading';
import StatusBadge from '@/components/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { formatDate } from '@/lib/format';
import { type ApprovalRequest, type ApprovalRequestStep, type BreadcrumbItem, type Office, type Subscription } from '@/types';
import { Head, Link, router } from '@inertiajs/react';

type HistoryRow = ApprovalRequestStep & { approval_request: ApprovalRequest };

type Bucket = 'pending' | 'approved' | 'released' | 'returned' | 'all';

interface PageLink {
    url: string | null;
    label: string;
    active: boolean;
}

interface PaginatedHistory {
    data: HistoryRow[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    links: PageLink[];
}

interface OfficesShowProps extends Record<string, unknown> {
    office: Office;
    chain_position: number | null;
    history: PaginatedHistory;
    counts: Record<Bucket, number>;
    assigned_subscriptions: Subscription[];
    filters: { status?: string | null };
}

const buckets: Bucket[] = ['pending', 'approved', 'released', 'returned', 'all'];

const bucketLabels: Record<Bucket, string> = {
    pending: 'Pending',
    approved: 'Approved',
    released: 'Released',
    returned: 'Returned',
    all: 'All',
};

/** Maps a raw step status onto the bucket a row is filed under. */
const stepBuckets: Record<string, Bucket> = {
    pending: 'pending',
    received: 'pending',
    approved: 'approved',
    forwarded: 'released',
    returned: 'returned',
};

const stepVariants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    pending: 'outline',
    received: 'secondary',
    approved: 'default',
    forwarded: 'secondary',
    returned: 'destructive',
};

export default function OfficeShow({ office, chain_position, history, counts, filters }: OfficesShowProps) {
    const activeBucket: Bucket = buckets.includes(filters.status as Bucket) ? (filters.status as Bucket) : 'all';

    const applyFilter = (bucket: Bucket) => {
        router.get(route('offices.show', office.id), bucket === 'all' ? {} : { status: bucket }, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
            only: ['history', 'filters'],
        });
    };

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Offices & Flows', href: '/offices' },
        { title: office.name, href: route('offices.show', office.id) },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`${office.name} — Office history`} />

            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-xl font-semibold">{office.name}</h1>
                            <Badge variant={office.is_active ? 'default' : 'secondary'}>{office.is_active ? 'Active' : 'Inactive'}</Badge>
                        </div>
                        <p className="text-muted-foreground text-sm">
                            {office.description ?? 'Waypoint office papers travel through.'}
                            {chain_position !== null && ` · Chain position #${chain_position}`}
                        </p>
                    </div>

                    <Link href={route('offices.index')}>
                        <Button variant="outline">Back to Offices</Button>
                    </Link>
                </div>

                <Heading
                    title="Subscription history"
                    description="Subscriptions whose papers have passed through this office, grouped by how the office handled them."
                />

                <div className="flex flex-wrap items-center gap-2">
                    {buckets.map((bucket) => (
                        <Button key={bucket} size="sm" variant={activeBucket === bucket ? 'default' : 'outline'} onClick={() => applyFilter(bucket)}>
                            {bucketLabels[bucket]}
                            <span className="ml-1.5 text-xs opacity-70">{counts[bucket]}</span>
                        </Button>
                    ))}
                </div>
                <Card>
                    <CardHeader>
                        <CardTitle>History at this office</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Subscription</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Received by</TableHead>
                                    <TableHead>Approved by</TableHead>
                                    <TableHead>Handled</TableHead>
                                    <TableHead>Remarks</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {history.data.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-muted-foreground py-6 text-center">
                                            {activeBucket === 'all'
                                                ? 'No subscriptions have passed through this office yet.'
                                                : `No ${bucketLabels[activeBucket].toLowerCase()} papers recorded at this office yet.`}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    history.data.map((row) => {
                                        const request = row.approval_request;
                                        const bucket = stepBuckets[row.status] ?? 'pending';
                                        const isHere = request.status === 'in_progress' && request.current_office_id === office.id;

                                        return (
                                            <TableRow key={row.id}>
                                                <TableCell>
                                                    <Link
                                                        href={route('subscriptions.show', request.subscription_id)}
                                                        className="font-medium hover:underline"
                                                    >
                                                        {request.subscription?.name ?? `Subscription #${request.subscription_id}`}
                                                    </Link>
                                                    {request.subscription && (
                                                        <div className="text-muted-foreground text-xs">{request.subscription.provider}</div>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="capitalize">
                                                        {request.type}
                                                    </Badge>
                                                    {request.flow && <div className="text-muted-foreground text-xs">{request.flow.name}</div>}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={stepVariants[row.status] ?? 'secondary'}>{bucketLabels[bucket]}</Badge>
                                                    {isHere && <div className="text-muted-foreground text-xs">Papers are here now</div>}
                                                </TableCell>
                                                <TableCell>{row.received_by_name ?? '—'}</TableCell>
                                                <TableCell>{row.approved_by_name ?? '—'}</TableCell>
                                                <TableCell>{formatDate(row.acted_at ?? row.received_at)}</TableCell>
                                                <TableCell className="max-w-xs truncate text-sm">{row.remarks ?? '—'}</TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>

                        {history.last_page > 1 && (
                            <div className="flex flex-col gap-3 border-t px-4 pt-4 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-muted-foreground text-sm">
                                    Showing {(history.current_page - 1) * history.per_page + 1} to{' '}
                                    {Math.min(history.current_page * history.per_page, history.total)} of {history.total}
                                </p>

                                <div className="flex flex-wrap items-center gap-1">
                                    {history.links.map((link, index) => (
                                        <Link
                                            key={index}
                                            href={link.url || '#'}
                                            preserveState
                                            preserveScroll
                                            only={['history', 'filters']}
                                            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                                                link.active ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
                                            } ${!link.url ? 'pointer-events-none opacity-40' : ''}`}
                                            dangerouslySetInnerHTML={{ __html: link.label }}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
                
            </div>
        </AppLayout>
    );
}
