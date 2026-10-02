import { type ApprovalFlow, type Owner } from '@/types';
import { useForm } from '@inertiajs/react';
import { type FormEventHandler, useState } from 'react';
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import SubscriptionForm, { type SubscriptionFormData } from '@/pages/subscriptions/partials/subscription-form';

type IntakeMode = 'approved' | 'for_approval';

interface CreateSubscriptionSheetProps {
    mode: IntakeMode;
    owners: Owner[];
    approvalFlows: ApprovalFlow[];
}

/**
 * Where each mode returns to once the record exists. Whitelisted server-side
 * by store() so this can never be turned into an open redirect.
 */
const returnRoutes: Record<IntakeMode, string> = {
    approved: 'subscriptions.index',
    for_approval: 'approvals.index',
};

const copy: Record<IntakeMode, { trigger: string; title: string; description: string; submitLabel: string }> = {
    approved: {
        trigger: 'New Subscription',
        title: 'New Subscription',
        description:
            'Register an existing subscription managed by the ICT department. Use Submit for Approval when it still has to travel an approval chain.',
        submitLabel: 'Create Subscription',
    },
    for_approval: {
        trigger: 'Submit for Approval',
        title: 'Submit for Approval',
        description:
            'Register a subscription and route it through an approval flow. Start and renewal dates are recorded once the chain is completed.',
        submitLabel: 'Submit for Approval',
    },
};

/**
 * Create a subscription without leaving the list it will appear on.
 *
 * The two intakes differ only in their shape, so one component covers both: an
 * approved subscription captures its dates up front, while one bound for a
 * chain has none yet and is parked in pending approval by the server.
 */
export default function CreateSubscriptionSheet({ mode, owners, approvalFlows }: CreateSubscriptionSheetProps) {
    const [open, setOpen] = useState(false);

    const forApproval = mode === 'for_approval';

    const { data, setData, transform, post, processing, errors, reset } = useForm<SubscriptionFormData>({
        provider: '',
        name: '',
        cost: '',
        billing_interval: '1',
        billing_interval_unit: 'year',
        start_date: '',
        renewal_date: '',
        owner_id: 'none',
        approval_flow_id: 'none',
        status: forApproval ? 'pending_approval' : 'active',
        description: '',
    });

    const submit: FormEventHandler = (event) => {
        event.preventDefault();

        transform((payload) => ({
            ...payload,
            intake_mode: mode,
            return_to: returnRoutes[mode],
            owner_id: payload.owner_id === 'none' ? null : payload.owner_id,
            approval_flow_id: payload.approval_flow_id === 'none' ? null : payload.approval_flow_id,
            // Left empty on purpose: a submission that has not cleared its
            // chain has no confirmed dates, and the server parks the record in
            // pending approval regardless of what arrives here.
            start_date: forApproval ? null : payload.start_date,
            renewal_date: forApproval ? null : payload.renewal_date,
        }));

        post(route('subscriptions.store'), {
            onSuccess: () => {
                setOpen(false);
                reset();
            },
        });
    };

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <Button onClick={() => setOpen(true)}>{copy[mode].trigger}</Button>

            <SheetContent side="right" className="flex flex-col gap-4 overflow-y-auto sm:max-w-2xl">
                <SheetHeader>
                    <SheetTitle>{copy[mode].title}</SheetTitle>
                    <SheetDescription>{copy[mode].description}</SheetDescription>
                </SheetHeader>

                <SubscriptionForm
                    data={data}
                    setData={setData}
                    errors={errors}
                    processing={processing}
                    submitLabel={copy[mode].submitLabel}
                    onSubmit={submit}
                    owners={owners}
                    approvalFlows={approvalFlows}
                    showDates={!forApproval}
                    showStatus={!forApproval}
                    showApprovalFlow={forApproval}
                />
            </SheetContent>
        </Sheet>
    );
}
