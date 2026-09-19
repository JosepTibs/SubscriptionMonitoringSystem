import Heading from '@/components/heading';
import StatusBadge from '@/components/status-badge';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { billingIntervalLabel, formatDate, formatPeso } from '@/lib/format';
import { type BreadcrumbItem, type Subscription } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { FormEventHandler } from 'react';

interface CreateRenewalProps {
    subscription: Subscription;
    suggested_renewal_date: string;
    suggested_cost: string;
}

export default function CreateRenewal({ subscription, suggested_renewal_date, suggested_cost }: CreateRenewalProps) {
    const { data, setData, post, processing, errors } = useForm({
        decision: 'pending',
        new_renewal_date: suggested_renewal_date,
        new_cost: suggested_cost,
        remarks: '',
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        post(route('subscriptions.renewals.store', subscription.id));
    };

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Subscriptions', href: '/subscriptions' },
        { title: subscription.name, href: route('subscriptions.show', subscription.id) },
        { title: 'Review Renewal', href: route('subscriptions.renewals.create', subscription.id) },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Review Renewal — ${subscription.name}`} />

            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <Heading
                    title={`Review Renewal — ${subscription.name}`}
                    description="Record a decision for this subscription's upcoming renewal. Nothing is renewed automatically."
                />

                <Card>
                    <CardContent className="grid gap-2 sm:grid-cols-4">
                        <div>
                            <span className="text-muted-foreground text-xs">Provider</span>
                            <p className="text-sm font-medium">{subscription.provider}</p>
                        </div>
                        <div>
                            <span className="text-muted-foreground text-xs">Billing interval</span>
                            <p className="text-sm font-medium">
                                {billingIntervalLabel(subscription.billing_interval, subscription.billing_interval_unit)}
                            </p>
                        </div>
                        <div>
                            <span className="text-muted-foreground text-xs">Current renewal date</span>
                            <p className="text-sm font-medium">{formatDate(subscription.renewal_date)}</p>
                        </div>
                        <div>
                            <span className="text-muted-foreground text-xs">Current cost / status</span>
                            <p className="flex items-center gap-2 text-sm font-medium">
                                {formatPeso(subscription.cost)} <StatusBadge status={subscription.status} />
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <form onSubmit={submit} className="space-y-6">
                    <div className="grid gap-6 md:grid-cols-2">
                        <div className="grid gap-2">
                            <Label htmlFor="decision">Decision</Label>
                            <Select value={data.decision} onValueChange={(value) => setData('decision', value)}>
                                <SelectTrigger id="decision" className="w-full">
                                    <SelectValue placeholder="Select a decision" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="renewed">Renewed</SelectItem>
                                    <SelectItem value="cancelled">Cancelled</SelectItem>
                                    <SelectItem value="pending">Keep Pending</SelectItem>
                                </SelectContent>
                            </Select>
                            <InputError message={errors.decision} />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="new_renewal_date">New renewal date</Label>
                            <Input
                                id="new_renewal_date"
                                type="date"
                                value={data.new_renewal_date}
                                onChange={(e) => setData('new_renewal_date', e.target.value)}
                            />
                            <InputError message={errors.new_renewal_date} />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="new_cost">New cost (₱)</Label>
                            <Input
                                id="new_cost"
                                type="number"
                                min="0"
                                step="0.01"
                                value={data.new_cost}
                                onChange={(e) => setData('new_cost', e.target.value)}
                            />
                            <InputError message={errors.new_cost} />
                        </div>

                        <div className="grid gap-2 md:col-span-2">
                            <Label htmlFor="remarks">Remarks</Label>
                            <textarea
                                id="remarks"
                                className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-lg border bg-transparent px-3 py-2 text-base transition-[color,box-shadow] outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                                value={data.remarks}
                                onChange={(e) => setData('remarks', e.target.value)}
                                placeholder="Optional notes about this decision"
                            />
                            <InputError message={errors.remarks} />
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <Button disabled={processing}>Record Decision</Button>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}
