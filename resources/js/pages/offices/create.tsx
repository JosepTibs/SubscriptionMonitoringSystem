import Heading from '@/components/heading';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { FormEventHandler } from 'react';
import OfficeForm, { type OfficeFormData } from './partials/office-form';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Offices', href: '/offices' },
    { title: 'New Office', href: '/offices/create' },
];

interface CreateOfficeProps extends Record<string, unknown> {
    next_sort_order: number;
}

export default function CreateOffice({ next_sort_order }: CreateOfficeProps) {
    const { data, setData, post, processing, errors } = useForm<OfficeFormData>({
        name: '',
        description: '',
        sort_order: String(next_sort_order),
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        post(route('offices.store'));
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="New Office" />

            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <Heading
                    title="New Office"
                    description="Offices are added to the end of the approval chain unless you set a custom order."
                />

                <OfficeForm
                    data={data}
                    setData={setData}
                    errors={errors}
                    processing={processing}
                    submitLabel="Create Office"
                    onSubmit={submit}
                />
            </div>
        </AppLayout>
    );
}
