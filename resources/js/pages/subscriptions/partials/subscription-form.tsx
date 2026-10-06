import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { type ApprovalFlow, type Owner, type Subscription } from '@/types';
import { type FormEventHandler, type Ref, useEffect, useRef, useState } from 'react';

export type SubscriptionFormData = {
    provider: string;
    name: string;
    cost: string;
    billing_interval: string;
    billing_interval_unit: 'month' | 'year';
    start_date: string;
    renewal_date: string;
    owner_id: string | null;
    approval_flow_id: string | null;
    status: string;
    description: string;
};

interface SubscriptionFormProps {
    data: SubscriptionFormData;
    setData: (key: string, value: string) => void;
    errors: Record<string, string>;
    processing: boolean;
    submitLabel: string;
    onSubmit: FormEventHandler;
    
    owners: Owner[];
    approvalFlows: ApprovalFlow[];
    subscription?: Subscription;
    showApprovalFlow?: boolean;
    showDates?: boolean;
    datesRequired?: boolean;
    showStatus?: boolean;
    showActions?: boolean;
    showDescription?: boolean;
    syncRenewalDate?: boolean;
    formRef?: Ref<HTMLFormElement>;
    extra?: React.ReactNode;
}

export default function SubscriptionForm({
    data,
    setData,
    errors,
    processing,
    submitLabel,
    onSubmit,
    owners,
    approvalFlows,
    showApprovalFlow = true,
    showDates = true,
    datesRequired = true,
    showStatus = true,
    showActions = true,
    showDescription = true,
    syncRenewalDate = true,
    formRef,
    extra,
}: SubscriptionFormProps) {
    // Snapshot of the seeded schedule values. The sync below must only react
    // to user edits after mount: a stored renewal that was deliberately set
    // off-interval has to survive opening the form untouched.
    const initialSyncKey = useRef<string | null>(null);

    useEffect(() => {
        if (!showDates || !syncRenewalDate) {
            return;
        }

        const key = `${data.start_date}|${data.billing_interval}|${data.billing_interval_unit}`;

        // First run just records the seeded values.
        if (initialSyncKey.current === null) {
            initialSyncKey.current = key;

            return;
        }

        if (key === initialSyncKey.current) {
            return;
        }

        initialSyncKey.current = key;

        if (data.start_date && data.billing_interval_unit === 'year') {
            const renewalDateAdd = data.billing_interval;
            const date = new Date(data.start_date);
            date.setFullYear(date.getFullYear() + Number(renewalDateAdd || 0));

            setData('renewal_date', date.toISOString().split('T')[0]);
        } else if (data.start_date && data.billing_interval_unit === 'month') {
            const renewalDateAdd = data.billing_interval;
            const date = new Date(data.start_date);
            date.setMonth(date.getMonth() + Number(renewalDateAdd || 0));

            setData('renewal_date', date.toISOString().split('T')[0]);
        }
    }, [data.start_date, data.billing_interval,data.billing_interval_unit, showDates, syncRenewalDate]);

    useEffect(() => {
        if (showApprovalFlow && (!data.approval_flow_id || data.approval_flow_id === 'none')) {
            const defaultFlow = approvalFlows.find((flow) => flow.is_default);

            if (defaultFlow) {
                setData('approval_flow_id', String(defaultFlow.id));
            }
        }
    }, [approvalFlows, showApprovalFlow]);

    

    const formatCost = (value: string) => {
        // Remove commas
        const clean = value.replace(/,/g, '');

        // Allow empty value
        if (!clean) return '';

        // Split integer and decimal parts
        const [integer, decimal] = clean.split('.');

        // Add commas to integer part
        const formattedInteger = Number(integer || '0').toLocaleString('en-PH');

        return decimal !== undefined ? `${formattedInteger}.${decimal.slice(0, 2)}` : formattedInteger;
    };

    return (
        <form ref={formRef} onSubmit={onSubmit} className="space-y-6">
            {extra}
            <div className="grid gap-6 md:grid-cols-2">
                <div className="grid gap-2">
                    <Label htmlFor="name">Subscription name</Label>
                    <Input id="name" value={data.name} onChange={(e) => setData('name', e.target.value)} placeholder="Microsoft 365" required />
                    <InputError message={errors.name} />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="provider">Provider</Label>
                    <Input
                        id="provider"
                        value={data.provider}
                        onChange={(e) => setData('provider', e.target.value)}
                        placeholder="Microsoft"
                        required
                    />
                    <InputError message={errors.provider} />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="cost">Cost (₱)</Label>

                    <Input
                        id="cost"
                        type="text"
                        inputMode="decimal"
                        value={formatCost(data.cost)}
                        onChange={(e) => {
                            const value = e.target.value.replace(/,/g, '');

                            // Allow only numbers with an optional decimal
                            if (/^\d*\.?\d{0,2}$/.test(value)) {
                                setData('cost', value);
                            }
                        }}
                        placeholder="50,000.00"
                        required
                    />

                    <InputError message={errors.cost} />
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                    <div className="grid gap-2">
                        <Label htmlFor="billing_interval">Billing interval</Label>
                        <Input
                            id="billing_interval"
                            type="number"
                            min="1"
                            value={data.billing_interval}
                            onChange={(e) => setData('billing_interval', e.target.value)}
                            required
                        />
                        <InputError message={errors.billing_interval} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="billing_interval_unit">Unit</Label>
                        <Select
                            value={data.billing_interval_unit}
                            onValueChange={(value: 'month' | 'year') => setData('billing_interval_unit', value)}
                        >
                            <SelectTrigger id="billing_interval_unit" className="w-full">
                                <SelectValue placeholder="Select unit" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="month">Month</SelectItem>
                                <SelectItem value="year">Year</SelectItem>
                            </SelectContent>
                        </Select>
                        <InputError message={errors.billing_interval_unit} />
                    </div>
                </div>

                {showDates && (
                    <>
                        <div className="grid gap-2">
                            <Label htmlFor="start_date">Start date</Label>
                            <Input
                                id="start_date"
                                type="date"
                                value={data.start_date}
                                onChange={(e) => setData('start_date', e.target.value)}
                                required={datesRequired}
                            />
                            <InputError message={errors.start_date} />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="renewal_date">Next renewal date</Label>
                            <Input
                                id="renewal_date"
                                type="date"
                                value={data.renewal_date}
                                onChange={(e) => setData('renewal_date', e.target.value)}
                                required={datesRequired}
                            />
                            <InputError message={errors.renewal_date} />
                        </div>
                    </>
                )}

                <div className="grid gap-2">
                    <Label htmlFor="owner_id">Owner</Label>
                    <Select value={data.owner_id ?? ''} onValueChange={(value) => setData('owner_id', value)}>
                        <SelectTrigger id="owner_id" className="w-full">
                            <SelectValue placeholder="Select an owner" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">Select Owner</SelectItem>
                            {owners.map((owner) => (
                                <SelectItem key={owner.id} value={String(owner.id)}>
                                    {owner.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <InputError message={errors.owner_id} />
                </div>

                {showStatus && (
                    <div className="grid gap-2">
                        <Label htmlFor="status">Status</Label>
                        <Select value={data.status} onValueChange={(value) => setData('status', value)}>
                            <SelectTrigger id="status" className="w-full">
                                <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="expired">Expired</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                                <SelectItem value="suspended">Suspended</SelectItem>
                                <SelectItem value="pending_approval">Pending Approval</SelectItem>
                            </SelectContent>
                        </Select>
                        <InputError message={errors.status} />
                    </div>
                )}

                {showApprovalFlow && (
                    <div className="grid gap-2">
                        <Label htmlFor="approval_flow_id">Approval flow</Label>
                        <Select value={data.approval_flow_id ?? ''} onValueChange={(value) => setData('approval_flow_id', value)}>
                            <SelectTrigger id="approval_flow_id" className="w-full">
                                <SelectValue placeholder="Default flow" />
                            </SelectTrigger>
                            <SelectContent>
                                {approvalFlows.map((flow) => (
                                    <SelectItem key={flow.id} value={String(flow.id)}>
                                        {flow.name}
                                        {flow.is_default ? ' (default)' : ''}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <InputError message={errors.approval_flow_id} />
                    </div>
                )}

                {showDescription && (
                    <div className="grid gap-2 md:col-span-2">
                        <Label htmlFor="description">Remarks / notes</Label>
                        <textarea
                            id="description"
                            value={data.description}
                            onChange={(e) => setData('description', e.target.value)}
                            className="border-input bg-background min-h-24 w-full rounded-md border px-3 py-2 text-sm"
                        />
                        <InputError message={errors.description} />
                    </div>
                )}
            </div>

            {showActions && (
                <div className="flex items-center gap-4">
                    <Button disabled={processing}>{submitLabel}</Button>
                </div>
            )}
        </form>
    );
}
