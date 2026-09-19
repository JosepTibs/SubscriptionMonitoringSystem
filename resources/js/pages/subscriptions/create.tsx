import Heading from '@/components/heading';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, type Office } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { FormEventHandler } from 'react';
import SubscriptionForm, { type SubscriptionFormData } from './partials/subscription-form';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Subscriptions', href: '/subscriptions' },
    { title: 'New Subscription', href: '/subscriptions/create' },
];

export default function CreateSubscription({ offices, owners }: { offices: Office[]; owners: { id: number; name: string }[] }) {
    const { data, setData, transform, post, processing, errors } = useForm<SubscriptionFormData>({
        provider: '',
        name: '',
        cost: '',
        billing_interval: '1',
        billing_interval_unit: 'year',
        start_date: '',
        renewal_date: '',
        office_id: 'none',
        owner_id: 'none',
        status: 'active',
        description: '',
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        transform((payload) => ({
            ...payload,
            office_id: payload.office_id === 'none' ? null : payload.office_id,
            owner_id: payload.owner_id === 'none' ? null : payload.owner_id,
        }));

        post(route('subscriptions.store'));
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="New Subscription" />

            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <Heading title="New Subscription" description="Register a subscription managed by the ICT department." />

                <SubscriptionForm
                    data={data}
                    setData={setData}
                    errors={errors}
                    processing={processing}
                    submitLabel="Create Subscription"
                    onSubmit={submit}
                    offices={offices}
                    owners={owners}
                />
            </div>
        </AppLayout>
    );
}
