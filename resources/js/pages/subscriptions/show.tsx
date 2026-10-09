import ApprovalCompletedBanner from '@/components/approval-completed-banner';
import ApprovalTrailTable from '@/components/approval-trail-table';
import { confirmRequest } from '@/components/confirm-dialog';
import RenewalReviewSheet from '@/components/renewal-review-sheet';
import StatusBadge from '@/components/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppLayout from '@/layouts/app-layout';
import { billingIntervalLabel, formatDate, formatPeso, toDateInputValue } from '@/lib/format';
import { type ApprovalFlow, type ApprovalRequest, type BreadcrumbItem, type Owner, type Renewal, type Subscription } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft, Check, ChevronDown, Pencil, X } from 'lucide-react';
import { useRef, useState, type FormEventHandler, type ReactNode } from 'react';
import SubscriptionForm, { type SubscriptionFormData } from './partials/subscription-form';

const baseBreadcrumbs: BreadcrumbItem[] = [{ title: 'Dashboard', href: '/dashboard' }];

function Detail({ label, value }: { label: string; value: ReactNode }) {
    return (
        <div className="grid gap-1">
            <span className="text-muted-foreground text-xs">{label}</span>
            <span className="text-sm font-medium">{value}</span>
        </div>
    );
}

/**
 * Chain status for one renewal row. Deferred ("pending") reviews open no
 * chain, so they show "No chain"; a linked request shows its live status
 * instead of the frozen submission-time decision.
 */
function chainForRenewal(renewal: Renewal): string | null {
    // Serialized as approval_request (snake_case); camelCase kept as fallback.
    const status = renewal.approval_request?.status ?? renewal.approvalRequest?.status ?? null;

    if (status === 'in_progress') {
        return 'Travelling';
    }

    if (status === 'completed') {
        return 'Applied';
    }

    if (status === 'returned' || status === 'rejected') {
        return status === 'returned' ? 'Returned' : 'Rejected';
    }

    return renewal.decision === 'pending' ? null : 'Recorded';
}

function renewalRequestId(renewal: Renewal): number | null {
    return renewal.approval_request?.id ?? renewal.approvalRequest?.id ?? renewal.approval_request_id ?? null;
}

function ChainBadge({ chain }: { chain: string | null }) {
    if (chain === null) {
        return <span className="text-muted-foreground text-xs">No chain (deferred)</span>;
    }

    return (
        <Badge variant={chain === 'Travelling' ? 'default' : chain === 'Applied' ? 'secondary' : 'outline'}>{chain}</Badge>
    );
}

function RenewalHistoryTable({
    subscription,
    onViewChain,
}: {
    subscription: Subscription;
    onViewChain: (requestId: number | null) => void;
}) {
    if (!subscription.renewals || subscription.renewals.length === 0) {
        return <p className="text-muted-foreground py-6 text-center text-sm">No renewals recorded yet.</p>;
    }

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Reviewed</TableHead>
                    <TableHead>Decision</TableHead>
                    <TableHead>Date (prev → new)</TableHead>
                    <TableHead>Cost (prev → new)</TableHead>
                    <TableHead>Chain</TableHead>
                    <TableHead className="text-right">Trail</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {subscription.renewals.map((renewal) => {
                    const chain = chainForRenewal(renewal);
                    const requestId = renewalRequestId(renewal);

                    return (
                        <TableRow key={renewal.id}>
                            <TableCell className="font-medium">#{renewal.id}</TableCell>
                            <TableCell>
                                <div>{formatDate(renewal.reviewed_at)}</div>
                                {renewal.reviewer && <div className="text-muted-foreground text-xs">{renewal.reviewer.name}</div>}
                            </TableCell>
                            <TableCell>
                                <Badge variant="secondary">{renewal.decision}</Badge>
                                {renewal.remarks && (
                                    <div className="text-muted-foreground max-w-48 truncate text-xs">{renewal.remarks}</div>
                                )}
                            </TableCell>
                            <TableCell>
                                {formatDate(renewal.previous_renewal_date)} → <strong>{formatDate(renewal.new_renewal_date)}</strong>
                            </TableCell>
                            <TableCell>
                                {formatPeso(renewal.previous_cost)} → <strong>{formatPeso(renewal.new_cost)}</strong>
                            </TableCell>
                            <TableCell>
                                <ChainBadge chain={chain} />
                            </TableCell>
                            <TableCell className="text-right">
                                {requestId !== null ? (
                                    <Button variant="outline" size="sm" onClick={() => onViewChain(requestId)}>
                                        View chain
                                    </Button>
                                ) : (
                                    <span className="text-muted-foreground text-xs">—</span>
                                )}
                            </TableCell>
                        </TableRow>
                    );
                })}
            </TableBody>
        </Table>
    );
}

export default function ShowSubscription({
    subscription,
    approval_requests,
    has_pending_renewal,
    pending_renewal_request_id,
    pending_renewal_office,
    days_until_renewal,
    suggested_renewal_date,
    suggested_cost,
    owners,
    approval_flows,
}: {
    subscription: Subscription;
    approval_requests: ApprovalRequest[];
    has_pending_renewal: boolean;
    pending_renewal_request_id: number | null;
    pending_renewal_office: string | null;
    days_until_renewal: number | null;
    suggested_renewal_date: string | null;
    suggested_cost: string;
    owners: Owner[];
    approval_flows: ApprovalFlow[];
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [detailTab, setDetailTab] = useState('details');
    const [expandedTrailId, setExpandedTrailId] = useState<number | null>(null);

    // Newest chain first (the controller sends latest() ordering): it sits
    // above the tabs as the working papers, while older chains collapse into
    // the trail tab. With the single in-flight guard the travelling chain, if
    // any, is always the newest; otherwise the last completed chain stays
    // visible instead of going empty.
    const currentTrail = approval_requests?.[0] ?? null;
    const previousTrails = approval_requests?.slice(1) ?? [];

    const jumpToTrail = (requestId: number | null | undefined) => {
        if (requestId === null || requestId === undefined) {
            return;
        }

        // The current chain sits above the tabs and is always visible; older
        // chains live collapsed in the trail tab.
        if (requestId !== currentTrail?.id) {
            setExpandedTrailId(requestId);
        }

        setDetailTab('trail');
    };

    // The detail page is shared: approval queue rows open the same component
    // as the subscription list, so the way back depends on what is on screen.
    // A subscription still travelling its chain returns to the approval queue;
    // everything else returns to the subscription list.
    const isFromApprovals = subscription.status === 'pending_approval';
    const listCrumb: BreadcrumbItem = isFromApprovals
        ? { title: 'Requests', href: '/approvals' }
        : { title: 'Subscriptions', href: '/subscriptions' };
    const backHref = isFromApprovals ? route('approvals.index') : route('subscriptions.index');
    const backLabel = isFromApprovals ? 'Back to Requests' : 'Back to Subscriptions';

    // A chain that has finished leaves a procurement subscription active but
    // still dateless - the dates are recorded by hand afterwards, so the
    // reminder is derived from the record rather than flashed once. It shows
    // for as long as either date is missing and stops the moment the edit form
    // saves them, because the re-rendered props no longer satisfy the
    // condition. Requiring a completed request keeps a subscription that is
    // still travelling its chain from being nagged.
    const isApprovalComplete = approval_requests?.some((request) => request.status === 'completed') ?? false;
    const isMissingDates = subscription.start_date === null || subscription.renewal_date === null;
    const showApprovalCompleted = isApprovalComplete && isMissingDates;

    // The partial submits the whole subscription, so every field the card does
    // not expose travels along untouched: billing interval, status and the
    // nullable ids are all required by subscriptions.update. They are seeded
    // from the model rather than left out so the payload stays identical to
    // the full edit form.
    const { data, setData, transform, patch, processing, errors, reset } = useForm<SubscriptionFormData>({
        provider: subscription.provider,
        name: subscription.name,
        cost: subscription.cost,
        billing_interval: String(subscription.billing_interval),
        billing_interval_unit: subscription.billing_interval_unit,
        start_date: toDateInputValue(subscription.start_date),
        renewal_date: toDateInputValue(subscription.renewal_date),
        owner_id: subscription.owner_id ? String(subscription.owner_id) : 'none',
        approval_flow_id: subscription.approval_flow_id ? String(subscription.approval_flow_id) : 'none',
        status: subscription.status,
        description: subscription.description ?? '',
    });

    const formRef = useRef<HTMLFormElement>(null);

    const submit: FormEventHandler = (event) => {
        event.preventDefault();

        transform((payload) => ({
            ...payload,
            owner_id: payload.owner_id === 'none' ? null : payload.owner_id,
            approval_flow_id: payload.approval_flow_id === 'none' ? null : payload.approval_flow_id,
        }));

        patch(route('subscriptions.update', subscription.id), {
            preserveScroll: true,
            onSuccess: () => {
                setIsEditing(false);
            },
        });
    };

    const cancelEditing = () => {
        reset();
        setIsEditing(false);
    };

    const cancel = async () => {
        const ok = await confirmRequest({
            title: `Cancel "${subscription.name}"?`,
            description: 'Its status will be set to cancelled. This cannot be undone.',
            confirmLabel: 'Cancel subscription',
        });

        if (ok) {
            patch(route('subscriptions.cancel', subscription.id));
        }
    };

    return (
        <AppLayout breadcrumbs={[...baseBreadcrumbs, listCrumb, { title: subscription.name, href: route('subscriptions.show', subscription.id) }]}>
            <Head title={subscription.name} />

            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <div>
                    <Link href={backHref}>
                        <Button variant="ghost" size="sm">
                            <ArrowLeft className="mr-1 h-4 w-4" /> {backLabel}
                        </Button>
                    </Link>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-xl font-semibold">{subscription.name}</h1>
                            <StatusBadge status={subscription.status} />
                        </div>
                        <p className="text-muted-foreground text-sm">{subscription.provider}</p>
                    </div>

                    <div className="flex items-center gap-2">
                        {subscription.status !== 'cancelled' && subscription.renewal_date !== null && (
                            <RenewalReviewSheet
                                subscription={subscription}
                                suggested_renewal_date={suggested_renewal_date ?? subscription.renewal_date}
                                suggested_cost={suggested_cost}
                                disabled={has_pending_renewal}
                                disabledReason={
                                    has_pending_renewal
                                        ? `Renewal #${pending_renewal_request_id ?? ''} is still travelling the chain${pending_renewal_office ? ` (at ${pending_renewal_office})` : ''}. Complete or return it before recording another.`
                                        : undefined
                                }
                                onRecorded={(decision) => setDetailTab(decision === 'cancelled' ? 'renewals' : 'details')}
                            />
                        )}


                        {subscription.status !== 'cancelled' && (
                            <Button variant="destructive" onClick={cancel} disabled={processing}>
                                Cancel Subscription
                            </Button>
                        )}
                    </div>
                </div>

                {showApprovalCompleted && <ApprovalCompletedBanner onEdit={() => setIsEditing(true)} editing={isEditing} />}

                {has_pending_renewal && (
                    <Card className="border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40">
                        <CardContent className="py-3 text-sm">
                            <strong>Renewal #{pending_renewal_request_id} is travelling the chain</strong>
                            {pending_renewal_office ? ` — currently at ${pending_renewal_office}.` : '.'} Recording
                            another renewal is blocked until it completes or is returned.
                        </CardContent>
                    </Card>
                )}

                {currentTrail !== null ? (
                    <ApprovalTrailTable key={currentTrail.id} request={currentTrail} />
                ) : (
                    <Card>
                        <CardContent className="text-muted-foreground py-6 text-center text-sm">
                            No approval chains recorded yet.
                        </CardContent>
                    </Card>
                )}

                <Tabs value={detailTab} onValueChange={setDetailTab}>
                    <TabsList>
                        <TabsTrigger value="details">Details</TabsTrigger>
                        <TabsTrigger value="renewals">Renewals ({subscription.renewals?.length ?? 0})</TabsTrigger>
                        <TabsTrigger value="trail">Approval trail ({previousTrails.length})</TabsTrigger>
                    </TabsList>

                    <TabsContent value="details">
                        <div className="grid gap-4">
                            <Card>
                        <CardHeader className="flex w-full flex-row items-center justify-between">
                            <CardTitle>Subscription details</CardTitle>
                            {!isEditing ? (
                                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                                    <Pencil className="h-4 w-4" /> Edit
                                </Button>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" size="icon" title="Discard changes" onClick={cancelEditing} disabled={processing}>
                                        <X className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        title="Save changes"
                                        onClick={() => formRef.current?.requestSubmit()}
                                        disabled={processing}
                                    >
                                        <Check className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}
                        </CardHeader>
                        {/* The partial brings its own two-column grid, so the card
                            drops its read-view grid while the editor is open. */}
                        <CardContent className={isEditing ? undefined : 'grid gap-4 sm:grid-cols-2'}>
                            {!isEditing ? (
                                <>
                                    <Detail label="Subscription name" value={subscription.name} />
                                    <Detail label="Provider" value={subscription.provider} />
                                    <Detail label="Cost" value={formatPeso(subscription.cost)} />
                                    <Detail
                                        label="Billing interval"
                                        value={billingIntervalLabel(subscription.billing_interval, subscription.billing_interval_unit)}
                                    />
                                    {subscription.status !== 'pending_approval' &&(
                                    <>
                                        <Detail label="Start date" value={formatDate(subscription.start_date)} />
                                        <Detail label="Next renewal date" value={formatDate(subscription.renewal_date)} />

                                         <Detail
                                        label="Days until renewal"
                                        value={
                                            subscription.status === 'cancelled' || days_until_renewal === null
                                                ? '—'
                                                : days_until_renewal < 0
                                                  ? `${Math.abs(days_until_renewal)} days overdue`
                                                  : `${days_until_renewal} days`
                                        }
                                    />
                                    </>
                                    )}
                                    
                                    <Detail label="Owner" value={subscription.owner?.name ?? '—'} />
                                    <Detail label="Subscription status" value={<StatusBadge status={subscription.status} />} />
                                   

                                    {subscription.renewal_date === null && (
                                        <p className="text-muted-foreground text-xs sm:col-span-2">
                                            Start and renewal dates are recorded once this subscription clears its approval chain.
                                        </p>
                                    )}

                                    <div className="grid gap-1 sm:col-span-2">
                                        <span className="text-muted-foreground text-xs">Remarks / notes</span>
                                        <span className="text-sm">{subscription.description ?? '—'}</span>
                                    </div>
                                </>
                            ) : (
                                <SubscriptionForm
                                    data={data}
                                    setData={setData}
                                    errors={errors}
                                    processing={processing}
                                    submitLabel="Save Changes"
                                    onSubmit={submit}
                                    formRef={formRef}
                                    owners={owners}
                                    approvalFlows={approval_flows}
                                    showStatus={false}
                                    showApprovalFlow={false}
                                    showActions={false}
                                    syncRenewalDate={true}
                                    showDates={subscription.status !== 'pending_approval'}
                                    datesRequired={subscription.status !== 'pending_approval'}
                                />
                            )}
                        </CardContent>
                    </Card>
                </div>
                    </TabsContent>

                    <TabsContent value="renewals">
                        <Card>
                            <CardHeader>
                                <CardTitle>Renewal history</CardTitle>
                                <p className="text-muted-foreground text-sm">
                                    Current cost {formatPeso(subscription.cost)} is shown once above — this table is
                                    history and is never summed.
                                </p>
                            </CardHeader>
                            <CardContent>
                                <RenewalHistoryTable subscription={subscription} onViewChain={jumpToTrail} />
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="trail">
                        <div className="grid gap-4">
                            {previousTrails.length > 0 ? (
                                previousTrails.map((request) => {
                                    const isOpen = expandedTrailId === request.id;
                                    const chainLabel =
                                        request.type === 'renewal' && request.renewal_id !== null
                                            ? `Renewal #${request.renewal_id}`
                                            : 'Procurement';

                                    return (
                                        <Collapsible
                                            key={request.id}
                                            open={isOpen}
                                            onOpenChange={(open) => setExpandedTrailId(open ? request.id : null)}
                                        >
                                            <Card>
                                                <CollapsibleTrigger asChild>
                                                    <button
                                                        type="button"
                                                        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm"
                                                    >
                                                        <span>
                                                            <strong>
                                                                {chainLabel} chain #{request.id}
                                                            </strong>{' '}
                                                            <StatusBadge status={request.status} />
                                                            {request.current_office && (
                                                                <span className="text-muted-foreground">
                                                                    {' '}
                                                                    — at {request.current_office.name}
                                                                </span>
                                                            )}
                                                        </span>
                                                        <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 [[data-state=open]_&]:rotate-180" />
                                                    </button>
                                                </CollapsibleTrigger>
                                                <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-up-1 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-down-1">
                                                    <CardContent className="pt-0">
                                                        <ApprovalTrailTable request={request} />
                                                    </CardContent>
                                                </CollapsibleContent>
                                            </Card>
                                        </Collapsible>
                                    );
                                })
                            ) : (
                                <Card>
                                    <CardContent className="text-muted-foreground py-6 text-center text-sm">
                                        {currentTrail !== null
                                            ? 'Only the current chain exists — it is shown open in Details.'
                                            : 'No approval chains recorded yet.'}
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </AppLayout>
    );
}
