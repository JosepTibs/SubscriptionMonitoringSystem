import Heading from '@/components/heading';
import AppLayout from '@/layouts/app-layout';
import { type ApprovalFlow, type BreadcrumbItem, type Office, type Subscription } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { FormEventHandler } from 'react';
import SubscriptionForm, { type SubscriptionFormData } from './partials/subscription-form';

interface EditProps {
    subscription: Subscription;
    offices: Office[];
    owners: { id: number; name: string }[];
    approval_flows: ApprovalFlow[];
}

export default function EditSubscription({ subscription, offices, owners, approval_flows }: EditProps) {
    const { data, setData, transform, put, processing, errors } = useForm<SubscriptionFormData>({
        provider: subscription.provider,
        name: subscription.name,
        cost: subscription.cost,
        billing_interval: String(subscription.billing_interval),
        billing_interval_unit: subscription.billing_interval_unit,
        start_date: subscription.start_date,
        renewal_date: subscription.renewal_date,
        office_id: subscription.office_id ? String(subscription.office_id) : 'none',
        owner_id: subscription.owner_id ? String(subscription.owner_id) : 'none',
        approval_flow_id: subscription.approval_flow_id ? String(subscription.approval_flow_id) : 'none',
        status: subscription.status,
        description: subscription.description ?? '',
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        transform((payload) => ({
            ...payload,
            office_id: payload.office_id === 'none' ? null : payload.office_id,
            owner_id: payload.owner_id === 'none' ? null : payload.owner_id,
            approval_flow_id: payload.approval_flow_id === 'none' ? null : payload.approval_flow_id,
        }));

        put(route('subscriptions.update', subscription.id));
    };

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Subscriptions', href: '/subscriptions' },
        { title: subscription.name, href: route('subscriptions.show', subscription.id) },
        { title: 'Edit', href: route('subscriptions.edit', subscription.id) },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Edit ${subscription.name}`} />

            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <Heading title={`Edit ${subscription.name}`} description="Update the subscription information." />

                <SubscriptionForm
                    data={data}
                    setData={setData}
                    errors={errors}
                    processing={processing}
                    submitLabel="Save Changes"
                    onSubmit={submit}
                    offices={offices}
                    owners={owners}
                    approvalFlows={approval_flows}
                    subscription={subscription}
                />
            </div>
        </AppLayout>
    );
}
