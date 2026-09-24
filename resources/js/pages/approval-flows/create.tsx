import Heading from '@/components/heading';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, type Office } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { type FormEventHandler } from 'react';
import FlowForm, { type FlowFormData } from './partials/flow-form';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Approval Flows', href: '/approval-flows' },
    { title: 'New Flow', href: '/approval-flows/create' },
];

interface CreateApprovalFlowProps extends Record<string, unknown> {
    offices: Office[];
}

export default function CreateApprovalFlow({ offices }: CreateApprovalFlowProps) {
    const { data, setData, post, processing, errors } = useForm<FlowFormData>({
        name: '',
        description: '',
        steps: [],
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        post(route('approval-flows.store'));
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="New Approval Flow" />

            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <Heading
                    title="New Approval Flow"
                    description="Build the office chain that papers travel through for this flow."
                />

                <FlowForm
                    data={data}
                    setData={setData}
                    errors={errors}
                    processing={processing}
                    submitLabel="Create Flow"
                    onSubmit={submit}
                    offices={offices}
                />
            </div>
        </AppLayout>
    );
}
