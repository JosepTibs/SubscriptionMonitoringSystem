import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { type ApprovalFlow, type Office, type Owner, type Subscription } from '@/types';
import { type FormEventHandler, useEffect, useState } from 'react';

export type SubscriptionFormData = {
    provider: string;
    name: string;
    cost: string;
    billing_interval: string;
    billing_interval_unit: 'month' | 'year';
    start_date: string;
    renewal_date: string;
    office_id: string | null;
    owner_id: string | null;
    approval_flow_id: string | null;
    received_by_name: string;
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
    offices: Office[];
    owners: Owner[];
    approvalFlows: ApprovalFlow[];
    subscription?: Subscription;
    showApprovalFlow?: boolean;
    showReceivedBy?: boolean;
    showDates?: boolean;
    datesRequired?: boolean;
    showStatus?: boolean;
    extra?: React.ReactNode;
}

export default function SubscriptionForm({
    data,
    setData,
    errors,
    processing,
    submitLabel,
    onSubmit,
    offices,
    owners,
    approvalFlows,
    showApprovalFlow = true,
    showReceivedBy = false,
    showDates = true,
    datesRequired = true,
    showStatus = true,
    extra,
}: SubscriptionFormProps) {
    useEffect(() => {
        if (!showDates) {
            return;
        }

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
    }, [data.start_date, data.billing_interval, showDates]);

    useEffect(() => {
        if (showApprovalFlow && (!data.approval_flow_id || data.approval_flow_id === 'none')) {
            const defaultFlow = approvalFlows.find((flow) => flow.is_default);

            if (defaultFlow) {
                setData('approval_flow_id', String(defaultFlow.id));
            }
        }
    }, [approvalFlows, showApprovalFlow]);

    const [costFocused, setCostFocused] = useState(false);

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
        <form onSubmit={onSubmit} className="space-y-6">
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

                {showReceivedBy && (
                    <div className="grid gap-2">
                        <Label htmlFor="received_by_name">Received by</Label>
                        <Input
                            id="received_by_name"
                            value={data.received_by_name}
                            onChange={(e) => setData('received_by_name', e.target.value)}
                            placeholder="Contact at the first office"
                            required
                        />
                        <InputError message={errors.received_by_name} />
                    </div>
                )}
            </div>

            <div className="flex items-center gap-4">
                <Button disabled={processing}>{submitLabel}</Button>
            </div>
        </form>
    );
}
