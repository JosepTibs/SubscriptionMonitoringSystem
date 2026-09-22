import Heading from '@/components/heading';
import AppLayout from '@/layouts/app-layout';
import { type ApprovalFlow, type BreadcrumbItem, type Office } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { type FormEventHandler } from 'react';
import FlowForm, { type FlowFormData } from './partials/flow-form';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Approval Flows', href: '/approval-flows' },
];

interface EditApprovalFlowProps extends Record<string, unknown> {
    approval_flow: ApprovalFlow;
    offices: Office[];
}

export default function EditApprovalFlow({ approval_flow: flow, offices }: EditApprovalFlowProps) {
    const { data, setData, patch, processing, errors } = useForm<FlowFormData>({
        name: flow.name,
        description: flow.description ?? '',
        steps: flow.steps.map((step) => String(step.office_id)),
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        patch(route('approval-flows.update', flow.id));
    };

    return (
        <AppLayout breadcrumbs={[...breadcrumbs, { title: flow.name, href: `/approval-flows/${flow.id}/edit` }]}>
            <Head title={`Edit Approval Flow — ${flow.name}`} />

            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <Heading
                    title={`Edit Approval Flow — ${flow.name}`}
                    description="Changing steps here only affects future requests; in-flight approval trails keep their original snapshot."
                />

                <FlowForm
                    data={data}
                    setData={setData}
                    errors={errors}
                    processing={processing}
                    submitLabel="Save Changes"
                    onSubmit={submit}
                    offices={offices}
                    flow={flow}
                />
            </div>
        </AppLayout>
    );
}
