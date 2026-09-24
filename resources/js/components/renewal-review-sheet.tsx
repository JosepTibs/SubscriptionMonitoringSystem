import InputError from '@/components/input-error';
import StatusBadge from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Sheet,
    SheetClose,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { billingIntervalLabel, formatDate, formatPeso } from '@/lib/format';
import { type Subscription } from '@/types';
import { useForm } from '@inertiajs/react';
import { FormEventHandler, useState } from 'react';

interface RenewalReviewSheetProps {
    subscription: Subscription;
    suggested_renewal_date: string;
    suggested_cost: string;
}

export default function RenewalReviewSheet({ subscription, suggested_renewal_date, suggested_cost }: RenewalReviewSheetProps) {
    const [open, setOpen] = useState(false);

    const { data, setData, post, processing, errors, reset } = useForm({
        decision: 'pending',
        new_renewal_date: suggested_renewal_date,
        new_cost: suggested_cost,
        remarks: '',
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        post(route('subscriptions.renewals.store', subscription.id), {
            onSuccess: () => {
                setOpen(false);
                reset();
            },
        });
    };

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <Button onClick={() => setOpen(true)}>Review Renewal</Button>

            <SheetContent side="right" className="flex flex-col overflow-y-auto gap-4 sm:max-w-lg">
                <SheetHeader>
                    <SheetTitle>Review Renewal — {subscription.name}</SheetTitle>
                    <SheetDescription>
                        Record a decision for this subscription's upcoming renewal. Renewed and pending decisions travel the approval chain and only apply once the final
                        office approves; a cancelled decision applies immediately.
                    </SheetDescription>
                </SheetHeader>

                <div className="grid gap-2 rounded-lg border p-3 text-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-xs">Billing interval</span>
                        <span className="font-medium">
                            {billingIntervalLabel(subscription.billing_interval, subscription.billing_interval_unit)}
                        </span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-xs">Current renewal date</span>
                        <span className="font-medium">{formatDate(subscription.renewal_date)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-xs">Current cost</span>
                        <span className="font-medium">{formatPeso(subscription.cost)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-xs">Status</span>
                        <StatusBadge status={subscription.status} />
                    </div>
                </div>
                <form onSubmit={submit} className="grid gap-4">
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

                    <div className="grid gap-2">
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

                    <div className="flex items-center gap-2">
                        <Button type="submit" disabled={processing}>
                            Record Decision
                        </Button>
                        <SheetClose asChild>
                            <Button type="button" variant="outline">
                                Cancel
                            </Button>
                        </SheetClose>
                    </div>
                </form>
            </SheetContent>
        </Sheet>
    );
}
