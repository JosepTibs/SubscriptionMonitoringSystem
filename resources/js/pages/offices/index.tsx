import Heading from '@/components/heading';
import AppLayout from '@/layouts/app-layout';
import { type ApprovalFlow, type BreadcrumbItem } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import { useState } from 'react';
import FlowFormSheet from '../approval-flows/partials/flow-form-sheet';
import FlowsTable from '../approval-flows/partials/flows-table';
import OfficeFormSheet, { type OfficeRow } from './partials/office-form-sheet';
import OfficesTable from './partials/offices-table';

interface OfficesFlowsIndexProps extends Record<string, unknown> {
    offices: OfficeRow[];
    flows: ApprovalFlow[];
    next_sort_order: number;
}

export default function OfficesFlowsIndex({ offices, flows, next_sort_order }: OfficesFlowsIndexProps) {
    /* Both /offices and /approval-flows render this screen; the crumb follows
       the URL so each entry point still feels native. */
    const { url } = usePage();
    const onFlows = url.startsWith('/approval-flows');

    const [officeTarget, setOfficeTarget] = useState<OfficeRow | 'new' | null>(null);
    const [flowTarget, setFlowTarget] = useState<ApprovalFlow | 'new' | null>(null);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        onFlows ? { title: 'Approval Flows', href: '/approval-flows' } : { title: 'Offices & Flows', href: '/offices' },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Offices & Flows" />

            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <Heading
                    title="Offices & Flows"
                    description="Offices are the waypoints papers travel through; flows are the named chains built from them."
                />

                <div className="grid items-start gap-4 xl:grid-cols-2">
                    <OfficesTable offices={offices} onCreate={() => setOfficeTarget('new')} onEdit={setOfficeTarget} />
                    <FlowsTable flows={flows} onCreate={() => setFlowTarget('new')} onEdit={setFlowTarget} />
                </div>
            </div>

            {officeTarget !== null && (
                <OfficeFormSheet
                    key={officeTarget === 'new' ? 'new' : `office-${officeTarget.id}`}
                    office={officeTarget === 'new' ? undefined : officeTarget}
                    nextSortOrder={next_sort_order}
                    onClose={() => setOfficeTarget(null)}
                />
            )}

            {flowTarget !== null && (
                <FlowFormSheet
                    key={flowTarget === 'new' ? 'new' : `flow-${flowTarget.id}`}
                    flow={flowTarget === 'new' ? undefined : flowTarget}
                    offices={offices}
                    onClose={() => setFlowTarget(null)}
                />
            )}
        </AppLayout>
    );
}
