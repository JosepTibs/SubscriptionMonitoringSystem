import Heading from '@/components/heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type ApprovalFlow, type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { Pencil, Star, StarOff } from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Approval Flows', href: '/approval-flows' },
];

interface ApprovalFlowsIndexProps extends Record<string, unknown> {
    flows: ApprovalFlow[];
}

export default function ApprovalFlowsIndex({ flows }: ApprovalFlowsIndexProps) {
    const setDefault = (flow: ApprovalFlow) => {
        router.patch(route('approval-flows.set-default', flow.id));
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Approval Flows" />

            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <Heading
                        title="Approval Flows"
                        description="Named office chains used to route subscriptions submitted for approval. The default flow applies when none is selected."
                    />
                    <Link href={route('approval-flows.create')}>
                        <Button>New Flow</Button>
                    </Link>
                </div>

                <Card>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Chain</TableHead>
                                    <TableHead className="text-center">Steps</TableHead>
                                    <TableHead className="text-center">Default</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {flows.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-muted-foreground py-6 text-center">
                                            No approval flows yet. Create one and set it as the default to enable intake for approval.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    flows.map((flow) => (
                                        <TableRow key={flow.id}>
                                            <TableCell>
                                                <div className="font-medium">{flow.name}</div>
                                                {flow.description && (
                                                    <div className="text-muted-foreground text-sm">{flow.description}</div>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <FlowChain flow={flow} />
                                            </TableCell>
                                            <TableCell className="text-center">{flow.steps.length}</TableCell>
                                            <TableCell className="text-center">
                                                {flow.is_default ? (
                                                    <Badge variant="default">Default</Badge>
                                                ) : (
                                                    <Badge variant="secondary">—</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="flex justify-end gap-1">
                                                <Link href={route('approval-flows.edit', flow.id)}>
                                                    <Button variant="ghost" size="sm" title="Edit flow">
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                </Link>
                                                <FlowDefaultButton flow={flow} onSetDefault={() => setDefault(flow)} />
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}


function FlowDefaultButton({ flow, onSetDefault }: { flow: ApprovalFlow; onSetDefault: () => void }) {
    return flow.is_default ? (
        <Button variant="ghost" size="sm" disabled title="This is the default flow">
            <StarOff className="h-4 w-4" />
        </Button>
    ) : (
        <Button variant="ghost" size="sm" onClick={onSetDefault} title="Set as default flow">
            <Star className="h-4 w-4" />
        </Button>
    );
}

function FlowChain({ flow }: { flow: ApprovalFlow }) {
    if (flow.steps.length === 0) {
        return <span className="text-muted-foreground text-sm">No steps</span>;
    }

    return (
        <div className="flex flex-wrap items-center gap-1 text-sm">
            {flow.steps.map((step, index) => (
                <span key={step.id} className="flex items-center gap-1">
                    {index > 0 && <span className="text-muted-foreground">→</span>}
                    <span className="rounded bg-muted px-2 py-0.5">{step.office?.name ?? `Office #${step.office_id}`}</span>
                </span>
            ))}
        </div>
    );
}
