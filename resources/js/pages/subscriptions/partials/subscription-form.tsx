import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { type Office, type Subscription } from '@/types';
import { type FormEventHandler } from 'react';

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
    owners: { id: number; name: string }[];
    subscription?: Subscription;
}

export default function SubscriptionForm({ data, setData, errors, processing, submitLabel, onSubmit, offices, owners }: SubscriptionFormProps) {
    return (
        <form onSubmit={onSubmit} className="space-y-6">
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
                        type="number"
                        min="0"
                        step="0.01"
                        value={data.cost}
                        onChange={(e) => setData('cost', e.target.value)}
                        placeholder="50000.00"
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

                <div className="grid gap-2">
                    <Label htmlFor="start_date">Start date</Label>
                    <Input id="start_date" type="date" value={data.start_date} onChange={(e) => setData('start_date', e.target.value)} required />
                    <InputError message={errors.start_date} />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="renewal_date">Next renewal date</Label>
                    <Input
                        id="renewal_date"
                        type="date"
                        value={data.renewal_date}
                        onChange={(e) => setData('renewal_date', e.target.value)}
                        required
                    />
                    <InputError message={errors.renewal_date} />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="office_id">Office (where used)</Label>
                    <Select value={data.office_id ?? ''} onValueChange={(value) => setData('office_id', value)}>
                        <SelectTrigger id="office_id" className="w-full">
                            <SelectValue placeholder="Select an office" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">— None —</SelectItem>
                            {offices.map((office) => (
                                <SelectItem key={office.id} value={String(office.id)}>
                                    {office.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <InputError message={errors.office_id} />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="owner_id">Owner</Label>
                    <Select value={data.owner_id ?? ''} onValueChange={(value) => setData('owner_id', value)}>
                        <SelectTrigger id="owner_id" className="w-full">
                            <SelectValue placeholder="Select an owner" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">— None —</SelectItem>
                            {owners.map((owner) => (
                                <SelectItem key={owner.id} value={String(owner.id)}>
                                    {owner.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <InputError message={errors.owner_id} />
                </div>

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
                        </SelectContent>
                    </Select>
                    <InputError message={errors.status} />
                </div>

                <div className="grid gap-2 md:col-span-2">
                    <Label htmlFor="description">Remarks / notes</Label>
                    <textarea
                        id="description"
                        className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-lg border bg-transparent px-3 py-2 text-base transition-[color,box-shadow] outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                        value={data.description}
                        onChange={(e) => setData('description', e.target.value)}
                        placeholder="Optional notes about this subscription"
                    />
                    <InputError message={errors.description} />
                </div>
            </div>

            <div className="flex items-center gap-4">
                <Button disabled={processing}>{submitLabel}</Button>
            </div>
        </form>
    );
}
