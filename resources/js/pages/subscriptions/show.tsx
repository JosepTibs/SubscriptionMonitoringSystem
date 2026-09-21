import RenewalReviewSheet from '@/components/renewal-review-sheet';
import StatusBadge from '@/components/status-badge';
import RenewalTimelineMock from '@/components/renewal-timeline-mock';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AppLayout from '@/layouts/app-layout';
import { billingIntervalLabel, formatDate, formatPeso } from '@/lib/format';
import { type BreadcrumbItem, type Subscription } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Subscriptions', href: '/subscriptions' },
];

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="grid gap-1">
            <span className="text-muted-foreground text-xs">{label}</span>
            <span className="text-sm font-medium">{value}</span>
        </div>
    );
}

export default function ShowSubscription({
    subscription,
    days_until_renewal,
    suggested_renewal_date,
    suggested_cost,
}: {
    subscription: Subscription;
    days_until_renewal: number;
    suggested_renewal_date: string;
    suggested_cost: string;
}) {
    const { patch, processing } = useForm();

    const cancel = () => {
        if (window.confirm(`Cancel "${subscription.name}"? Its status will be set to cancelled.`)) {
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
                        {subscription.status !== 'cancelled' && (
                            <RenewalReviewSheet
                                subscription={subscription}
                                suggested_renewal_date={suggested_renewal_date}
                                suggested_cost={suggested_cost}
                            />
                        )}

                        <Link href={route('subscriptions.edit', subscription.id)}>
                            <Button variant="outline">Edit</Button>
                        </Link>

                        {subscription.status !== 'cancelled' && (
                            <Button variant="destructive" onClick={cancel} disabled={processing}>
                                Cancel Subscription
                            </Button>
                        )}
                    </div>
                </div>

                <RenewalTimelineMock />

                <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Subscription details</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4 sm:grid-cols-2">
                            <Detail label="Subscription name" value={subscription.name} />
                            <Detail label="Provider" value={subscription.provider} />
                            <Detail label="Cost" value={formatPeso(subscription.cost)} />
                            <Detail
                                label="Billing interval"
                                value={billingIntervalLabel(subscription.billing_interval, subscription.billing_interval_unit)}
                            />
                            <Detail label="Start date" value={formatDate(subscription.start_date)} />
                            <Detail label="Next renewal date" value={formatDate(subscription.renewal_date)} />
                            <Detail label="Office" value={subscription.office?.name ?? '—'} />
                            <Detail label="Owner" value={subscription.owner?.name ?? '—'} />
                            <Detail label="Subscription status" value={<StatusBadge status={subscription.status} />} />
                            <Detail
                                label="Days until renewal"
                                value={
                                    subscription.status === 'cancelled'
                                        ? '—'
                                        : days_until_renewal < 0
                                          ? `${Math.abs(days_until_renewal)} days overdue`
                                          : `${days_until_renewal} days`
                                }
                            />
                            <div className="grid gap-1 sm:col-span-2">
                                <span className="text-muted-foreground text-xs">Remarks / notes</span>
                                <span className="text-sm">{subscription.description ?? '—'}</span>
                            </div>
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
