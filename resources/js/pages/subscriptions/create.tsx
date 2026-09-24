import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import AppLayout from '@/layouts/app-layout';
import { type ApprovalFlow, type BreadcrumbItem, type Office } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { CheckCircle2, Send } from 'lucide-react';
import { type FormEventHandler, useState } from 'react';
import SubscriptionForm, { type SubscriptionFormData } from './partials/subscription-form';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Subscriptions', href: '/subscriptions' },
    { title: 'New Subscription', href: '/subscriptions/create' },
];

type IntakeMode = 'approved' | 'for_approval';

interface CreateProps {
    offices: Office[];
    owners: { id: number; name: string }[];
    approval_flows: ApprovalFlow[];
}

export default function CreateSubscription({ offices, owners, approval_flows }: CreateProps) {
    const [intakeMode, setIntakeMode] = useState<IntakeMode>('approved');

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
        approval_flow_id: 'none',
        status: 'active',
        description: '',
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        transform((payload) => ({
            ...payload,
            intake_mode: intakeMode,
            office_id: payload.office_id === 'none' ? null : payload.office_id,
            owner_id: payload.owner_id === 'none' ? null : payload.owner_id,
            approval_flow_id: payload.approval_flow_id === 'none' ? null : payload.approval_flow_id,
        }));

        post(route('subscriptions.store'));
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="New Subscription" />

            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <Heading title="New Subscription" description="Register a subscription managed by the ICT department." />

                <Card>
                    <CardContent className="grid gap-3">
                        <div className="text-sm font-medium">Approval</div>
                        <div className="flex flex-wrap gap-2">
                            <Button
                                type="button"
                                variant={intakeMode === 'approved' ? 'default' : 'outline'}
                                onClick={() => setIntakeMode('approved')}
                            >
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                Already approved
                            </Button>
                            <Button
                                type="button"
                                variant={intakeMode === 'for_approval' ? 'default' : 'outline'}
                                onClick={() => setIntakeMode('for_approval')}
                            >
                                <Send className="mr-2 h-4 w-4" />
                                Send for approval
                            </Button>
                        </div>
                        <p className="text-muted-foreground text-sm">
                            {intakeMode === 'approved'
                                ? 'The subscription is entered as active immediately; no approval chain is started.'
                                : 'The subscription is created as pending approval and routed through the selected approval flow.'}
                        </p>
                    </CardContent>
                </Card>

                <SubscriptionForm
                    data={data}
                    setData={setData}
                    errors={errors}
                    processing={processing}
                    submitLabel="Create Subscription"
                    onSubmit={submit}
                    offices={offices}
                    owners={owners}
                    approvalFlows={approval_flows}
                    showApprovalFlow={intakeMode === 'for_approval'}
                />
            </div>
        </AppLayout>
    );
}
