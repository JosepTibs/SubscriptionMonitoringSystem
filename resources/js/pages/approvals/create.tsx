import Heading from '@/components/heading';
import AppLayout from '@/layouts/app-layout';
import { type ApprovalFlow, type BreadcrumbItem, type Owner } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { type FormEventHandler } from 'react';
import SubscriptionForm, { type SubscriptionFormData } from '../subscriptions/partials/subscription-form';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Approvals', href: '/approvals' },
    { title: 'Submit for Approval', href: '/approvals/create' },
];

interface CreateApprovalProps {
    owners: Owner[];
    approval_flows: ApprovalFlow[];
}

/**
 * Intake for a subscription that still has to travel an approval chain.
 *
 * The start and renewal dates are deliberately absent: a submission that has
 * not cleared its chain has no confirmed dates yet, so they are recorded once
 * the chain completes. The status is likewise left to the server, which parks
 * the subscription in pending approval.
 */
export default function SubmitForApproval({ owners, approval_flows }: CreateApprovalProps) {
    const { data, setData, transform, post, processing, errors } = useForm<SubscriptionFormData>({
        provider: '',
        name: '',
        cost: '',
        billing_interval: '1',
        billing_interval_unit: 'year',
        start_date: '',
        renewal_date: '',
        owner_id: 'none',
        approval_flow_id: 'none',
        status: 'pending_approval',
        description: '',
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        transform((payload) => ({
            ...payload,
            intake_mode: 'for_approval',
            owner_id: payload.owner_id === 'none' ? null : payload.owner_id,
            approval_flow_id: payload.approval_flow_id === 'none' ? null : payload.approval_flow_id,
            // Left empty on purpose: the dates travel with the subscription once
            // the chain completes, not with the submission.
            start_date: null,
            renewal_date: null,
        }));

        post(route('subscriptions.store'));
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Submit for Approval" />

            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <Heading
                    title="Submit for Approval"
                    description="Register a subscription and route it through an approval flow. Start and renewal dates are recorded once the chain is completed."
                />

                <SubscriptionForm
                    data={data}
                    setData={setData}
                    errors={errors}
                    processing={processing}
                    submitLabel="Submit for Approval"
                    onSubmit={submit}
                    owners={owners}
                    approvalFlows={approval_flows}
                    showDates={false}
                    showStatus={false}
                />
            </div>
        </AppLayout>
    );
}
