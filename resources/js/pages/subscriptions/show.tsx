import ApprovalCompletedBanner from '@/components/approval-completed-banner';
import ApprovalTrailTable from '@/components/approval-trail-table';
import { confirmRequest } from '@/components/confirm-dialog';
import RenewalReviewSheet from '@/components/renewal-review-sheet';
import StatusBadge from '@/components/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AppLayout from '@/layouts/app-layout';
import { billingIntervalLabel, formatDate, formatPeso } from '@/lib/format';
import { type ApprovalFlow, type ApprovalRequest, type BreadcrumbItem, type Owner, type Subscription } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';
import { Check, Pencil, X } from 'lucide-react';
import { useRef, useState, type FormEventHandler, type ReactNode } from 'react';
import SubscriptionForm, { type SubscriptionFormData } from './partials/subscription-form';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Subscriptions', href: '/subscriptions' },
];

function Detail({ label, value }: { label: string; value: ReactNode }) {
    return (
        <div className="grid gap-1">
            <span className="text-muted-foreground text-xs">{label}</span>
            <span className="text-sm font-medium">{value}</span>
        </div>
    );
}

export default function ShowSubscription({
    subscription,
    approval_requests,
    days_until_renewal,
    suggested_renewal_date,
    suggested_cost,
    owners,
    approval_flows,
}: {
    subscription: Subscription;
    approval_requests: ApprovalRequest[];
    days_until_renewal: number | null;
    suggested_renewal_date: string | null;
    suggested_cost: string;
    owners: Owner[];
    approval_flows: ApprovalFlow[];
}) {
    const [isEditing, setIsEditing] = useState(false);

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
        start_date: subscription.start_date ?? '',
        renewal_date: subscription.renewal_date ?? '',
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
        <AppLayout breadcrumbs={[...breadcrumbs, { title: subscription.name, href: route('subscriptions.show', subscription.id) }]}>
            <Head title={subscription.name} />

            <div className="flex h-full flex-1 flex-col gap-4 p-4">
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

                {approval_requests?.map((request) => (
                    <ApprovalTrailTable key={request.id} request={request} />
                ))}

                <div className="grid gap-4 md:grid-cols-2">
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

                    <Card>
                        <CardHeader>
                            <CardTitle>Renewal history</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {subscription.renewals && subscription.renewals.length > 0 ? (
                                <div className="space-y-4">
                                    {subscription.renewals.map((renewal) => (
                                        <div key={renewal.id} className="rounded-lg border p-3">
                                            <div className="flex items-center justify-between">
                                                <Badge variant="secondary">{renewal.decision}</Badge>
                                                <span className="text-muted-foreground text-xs">{formatDate(renewal.reviewed_at)}</span>
                                            </div>
                                            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                                                <span>
                                                    Previous renewal: <strong>{formatDate(renewal.previous_renewal_date)}</strong>
                                                </span>
                                                <span>
                                                    New renewal: <strong>{formatDate(renewal.new_renewal_date)}</strong>
                                                </span>
                                                <span>
                                                    Previous cost: <strong>{formatPeso(renewal.previous_cost)}</strong>
                                                </span>
                                                <span>
                                                    New cost: <strong>{formatPeso(renewal.new_cost)}</strong>
                                                </span>
                                            </div>
                                            {renewal.remarks && <p className="text-muted-foreground mt-2 text-sm">{renewal.remarks}</p>}
                                            {renewal.reviewer && (
                                                <p className="text-muted-foreground mt-1 text-xs">Reviewed by {renewal.reviewer.name}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-muted-foreground py-6 text-center text-sm">No renewals recorded yet.</p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AppLayout>
    );
}
