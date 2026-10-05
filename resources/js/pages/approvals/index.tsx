import { confirmRequest } from '@/components/confirm-dialog';
import ApprovalActions from '@/components/approval-actions';
import ApprovalStepper from '@/components/approval-stepper';
import CreateSubscriptionSheet from '@/components/create-subscription-sheet';
import Heading from '@/components/heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type ApprovalFlow, type ApprovalRequest, type BreadcrumbItem, type Office, type Owner, type SharedData } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { Archive, ArchiveRestore, Trash2 } from 'lucide-react';
import { useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Approvals', href: '/approvals' },
];

const allValue = 'all';

const statusLabels: Record<string, string> = {
    in_progress: 'In progress',
    completed: 'Completed',
    returned: 'Returned',
    rejected: 'Rejected',
};

const statusVariants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    in_progress: 'secondary',
    completed: 'default',
    returned: 'destructive',
    rejected: 'destructive',
};

interface QueueLink {
    url: string | null;
    label: string;
    active: boolean;
}

interface PaginatedRequests {
    data: ApprovalRequest[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    links: QueueLink[];
}

interface ApprovalsIndexProps extends Record<string, unknown> {
    requests: PaginatedRequests;
    offices: Office[];
    owners: Owner[];
    approval_flows: ApprovalFlow[];
    filters: { status?: string; type?: string; office_id?: string; show?: string };
    counts: { in_progress: number; completed: number; returned: number };
}

function waitingLabel(request: ApprovalRequest): string {
    const days = Math.max(0, Math.floor((Date.now() - new Date(request.created_at).getTime()) / 86400000));

    if (days === 0) {
        return 'Today';
    }

    return days === 1 ? '1 day' : `${days} days`;
}

export default function ApprovalsIndex({ requests, offices, owners, approval_flows, filters, counts }: ApprovalsIndexProps) {
    const { auth } = usePage<SharedData>().props;
    const canManage = auth.can_manage_records;
    const archivedView = filters.show === 'archived';
    const [status, setStatus] = useState(filters.status && filters.status !== allValue ? filters.status : 'in_progress');
    const [type, setType] = useState(filters.type && filters.type !== allValue ? filters.type : allValue);
    const [officeId, setOfficeId] = useState(filters.office_id && filters.office_id !== allValue ? String(filters.office_id) : allValue);

    /**
     * Navigate with the filters as they will be once this change is applied.
     *
     * The patch uses the state names - `status`, `type`, `officeId` - so it
     * always overrides the value it replaces: the setters above have not landed
     * yet when this runs, and reading state alone would resend the value being
     * replaced (picking "All" would silently keep the previous filter alive).
     * The parameter is typed to those three keys so a stray query name such as
     * `office_id` cannot slip in and set a key nothing ever reads.
     */
    const applyFilters = (patch: Partial<Record<'status' | 'type' | 'officeId' | 'show', string>> = {}) => {
        const next = { status, type, officeId, show: archivedView ? 'archived' : allValue, ...patch };

        const params: Record<string, string> = {
            ...(next.status !== '' && next.status !== allValue ? { status: next.status } : {}),
            ...(next.type !== '' && next.type !== allValue ? { type: next.type } : {}),
            ...(next.officeId !== '' && next.officeId !== allValue ? { office_id: next.officeId } : {}),
            ...(next.show === 'archived' ? { show: 'archived' } : {}),
        };

        router.get(route('approvals.index'), params, {
            only: ['requests', 'filters'],
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const resetFilters = () => {
        setStatus('in_progress');
        setType(allValue);
        setOfficeId(allValue);

        router.get(
            route('approvals.index'),
            archivedView ? { show: 'archived' } : {},
            { only: ['requests', 'filters'], preserveState: true, preserveScroll: true, replace: true },
        );
    };

    async function handleArchive(request: ApprovalRequest) {
        const ok = await confirmRequest({
            title: `Archive request #${request.id}?`,
            description: 'It will be hidden from the queue. You can bring it back from the Archived view.',
            confirmLabel: 'Archive',
            destructive: false,
        });

        if (ok) {
            router.patch(route('approval-requests.archive', request.id), {}, { preserveScroll: true });
        }
    }

    async function handleUnarchive(request: ApprovalRequest) {
        const ok = await confirmRequest({
            title: `Unarchive request #${request.id}?`,
            description: 'It will show in the queue again.',
            confirmLabel: 'Unarchive',
            destructive: false,
        });

        if (ok) {
            router.patch(route('approval-requests.unarchive', request.id), {}, { preserveScroll: true });
        }
    }

    async function handleDelete(request: ApprovalRequest) {
        const ok = await confirmRequest({
            title: `Delete request #${request.id}?`,
            description: 'This permanently erases the chain and its snapshot steps. This action cannot be undone.',
            confirmLabel: 'Delete request',
        });

        if (ok) {
            router.delete(route('approval-requests.destroy', request.id), { preserveScroll: true });
        }
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Approvals" />

            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <Heading
                        title="Approvals"
                        description="Requests still travelling the chain, oldest first. Your account is not tied to an office yet, so pick an office to narrow the queue."
                    />

                    <CreateSubscriptionSheet mode="for_approval" owners={owners} approvalFlows={approval_flows} />
                </div>

                <Card>
                    <CardContent>
                        <div className="flex flex-wrap items-center gap-2 pb-4">
                            <Select
                                value={status}
                                onValueChange={(value) => {
                                    setStatus(value);
                                    applyFilters({ status: value });
                                }}
                            >
                                <SelectTrigger className="w-44" aria-label="Status">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="in_progress">{`In progress (${counts.in_progress})`}</SelectItem>
                                    <SelectItem value="completed">{`Completed (${counts.completed})`}</SelectItem>
                                    <SelectItem value="returned">{`Returned (${counts.returned})`}</SelectItem>
                                </SelectContent>
                            </Select>

                            <Select
                                value={type}
                                onValueChange={(value) => {
                                    setType(value);
                                    applyFilters({ type: value });
                                }}
                            >
                                <SelectTrigger className="w-44" aria-label="Type">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={allValue}>All types</SelectItem>
                                    <SelectItem value="procurement">Procurement</SelectItem>
                                    <SelectItem value="renewal">Renewal</SelectItem>
                                </SelectContent>
                            </Select>

                            <Select
                                value={officeId}
                                onValueChange={(value) => {
                                    setOfficeId(value);
                                    applyFilters({ officeId: value });
                                }}
                            >
                                <SelectTrigger className="w-56" aria-label="Office">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={allValue}>All offices</SelectItem>
                                    {offices.map((office) => (
                                        <SelectItem key={office.id} value={String(office.id)}>
                                            {office.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Select
                                value={archivedView ? 'archived' : allValue}
                                onValueChange={(value) => applyFilters({ show: value })}
                            >
                                <SelectTrigger className="w-36" aria-label="Archived filter">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={allValue}>Active</SelectItem>
                                    <SelectItem value="archived">Archived</SelectItem>
                                </SelectContent>
                            </Select>

                            <Button variant="ghost" onClick={resetFilters}>
                                Reset
                            </Button>
                        </div>

                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Subscription</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Chain</TableHead>
                                    <TableHead>Current office</TableHead>
                                    <TableHead className="text-center">Waiting</TableHead>
                                    {canManage && <TableHead className="text-right">Actions</TableHead>}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {requests.data.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-muted-foreground py-6 text-center">
                                            Nothing waiting under this filter. Switch the status filter to browse history.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    requests.data.map((request) => (
                                        <TableRow key={request.id}>
                                            <TableCell>
                                                <Link
                                                    href={route('subscriptions.show', request.subscription_id)}
                                                    className="font-medium hover:underline"
                                                >
                                                    {request.subscription?.name ?? `Subscription #${request.subscription_id}`}
                                                </Link>
                                                <div className="text-muted-foreground text-sm">
                                                    {request.subscription?.provider ?? '-'}
                                                    {request.subscription?.office ? ` - ${request.subscription.office.name}` : ''}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="capitalize">
                                                    {request.type}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <ApprovalStepper request={request} />
                                            </TableCell>
                                            <TableCell>
                                                {request.current_office?.name ?? (request.status === 'in_progress' ? 'Unassigned' : '-')}
                                                {request.flow && <div className="text-muted-foreground text-xs">{request.flow.name}</div>}
                                            </TableCell>
                                            <TableCell className="text-center">{waitingLabel(request)}</TableCell>
                                            {canManage && (
                                                <TableCell>
                                                    <div className="flex justify-end gap-2">
                                                        {archivedView ? (
                                                            <Button variant="outline" size="sm" onClick={() => handleUnarchive(request)}>
                                                                <ArchiveRestore className="h-4 w-4" />
                                                            </Button>
                                                        ) : (
                                                            <Button variant="outline" size="sm" onClick={() => handleArchive(request)}>
                                                                <Archive className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="text-red-600 hover:text-red-700"
                                                            onClick={() => handleDelete(request)}
                                                            disabled={request.status === 'in_progress' && !archivedView}
                                                            title={
                                                                request.status === 'in_progress' && !archivedView
                                                                    ? 'Archive a travelling request instead of deleting it'
                                                                    : `Delete request #${request.id}`
                                                            }
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>

                        {requests.last_page > 1 && (
                            <div className="flex flex-col gap-3 border-t px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-muted-foreground text-sm">
                                    Showing {(requests.current_page - 1) * requests.per_page + 1} to{' '}
                                    {Math.min(requests.current_page * requests.per_page, requests.total)} of {requests.total}
                                </p>

                                <div className="flex flex-wrap items-center gap-1">
                                    {requests.links.map((link, index) => (
                                        <Link
                                            key={index}
                                            href={link.url || '#'}
                                            preserveState
                                            preserveScroll
                                            only={['requests', 'filters']}
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
