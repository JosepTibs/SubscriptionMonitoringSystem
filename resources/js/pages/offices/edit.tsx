import Heading from '@/components/heading';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, type Office } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { FormEventHandler } from 'react';
import OfficeForm, { type OfficeFormData } from './partials/office-form';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Offices', href: '/offices' },
];

interface EditOfficeProps extends Record<string, unknown> {
    office: Office;
}

export default function EditOffice({ office }: EditOfficeProps) {
    const { data, setData, patch, processing, errors } = useForm<OfficeFormData>({
        name: office.name,
        description: office.description ?? '',
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        patch(route('offices.update', office.id));
    };

    return (
        <AppLayout breadcrumbs={[...breadcrumbs, { title: office.name, href: `/offices/${office.id}/edit` }]}>
            <Head title={`Edit Office — ${office.name}`} />

            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <Heading title={`Edit Office — ${office.name}`} description="Update the office details. Use the Offices list to reorder the approval chain." />

                <OfficeForm
                    data={data}
                    setData={setData}
                    errors={errors}
                    processing={processing}
                    submitLabel="Save Changes"
                    onSubmit={submit}
                />
            </div>
        </AppLayout>
    );
}
