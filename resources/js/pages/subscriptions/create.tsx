import Heading from '@/components/heading';
import AppLayout from '@/layouts/app-layout';
import { type ApprovalFlow, type BreadcrumbItem, type Owner } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { type FormEventHandler } from 'react';
import SubscriptionForm, { type SubscriptionFormData } from './partials/subscription-form';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Subscriptions', href: '/subscriptions' },
    { title: 'New Subscription', href: '/subscriptions/create' },
];

interface CreateProps {
    owners: Owner[];
    approval_flows: ApprovalFlow[];
}

/**
 * Intake for a subscription that is already in place: nothing travels an
 * approval chain here, so the dates are captured up front. Subscriptions that
 * still need sign-off are registered from the approvals screen instead.
 */
export default function CreateSubscription({ owners, approval_flows }: CreateProps) {
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
        status: 'active',
        description: '',
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        transform((payload) => ({
            ...payload,
            intake_mode: 'approved',
            owner_id: payload.owner_id === 'none' ? null : payload.owner_id,
            approval_flow_id: payload.approval_flow_id === 'none' ? null : payload.approval_flow_id,
        }));

        post(route('subscriptions.store'));
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="New Subscription" />

            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <Heading
                    title="New Subscription"
                    description="Register an existing subscription managed by the ICT department. Use Submit for Approval when it still has to travel an approval chain."
                />

                <SubscriptionForm
                    data={data}
                    setData={setData}
                    errors={errors}
                    processing={processing}
                    submitLabel="Create Subscription"
                    onSubmit={submit}
                    owners={owners}
                    approvalFlows={approval_flows}
                    showApprovalFlow={false}
                />
            </div>
        </AppLayout>
    );
}
