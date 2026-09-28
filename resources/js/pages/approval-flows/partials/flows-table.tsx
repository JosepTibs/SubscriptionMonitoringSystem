import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { type ApprovalFlow } from '@/types';
import { router } from '@inertiajs/react';
import { Pencil, Star, StarOff } from 'lucide-react';

interface FlowsTableProps {
    flows: ApprovalFlow[];
    onCreate: () => void;
    onEdit: (flow: ApprovalFlow) => void;
}

export default function FlowsTable({ flows, onCreate, onEdit }: FlowsTableProps) {
    const setDefault = (flow: ApprovalFlow) => {
        router.patch(route('approval-flows.set-default', flow.id));
    };

    return (
        <Card>
            <CardContent>
                <div className="flex flex-wrap items-center justify-between gap-4 pt-4">
                    <div>
                        <h2 className="text-base font-semibold">Approval Flows</h2>
                        <p className="text-muted-foreground text-sm">
                            Named chains built from offices. The default flow applies when none is selected.
                        </p>
                    </div>
                    <Button size="sm" onClick={onCreate}>
                        New Flow
                    </Button>
                </div>

                <Table className="mt-4">
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
                                        {flow.description && <div className="text-muted-foreground text-sm">{flow.description}</div>}
                                    </TableCell>
                                    <TableCell>
                                        <FlowChain flow={flow} />
                                    </TableCell>
                                    <TableCell className="text-center">{flow.steps.length}</TableCell>
                                    <TableCell className="text-center">
                                        {flow.is_default ? <Badge variant="default">Default</Badge> : <Badge variant="secondary">—</Badge>}
                                    </TableCell>
                                    <TableCell className="flex justify-end gap-1">
                                        <Button variant="ghost" size="sm" onClick={() => onEdit(flow)} title="Edit flow">
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <FlowDefaultButton flow={flow} onSetDefault={() => setDefault(flow)} />
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
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
                    <span className="bg-muted rounded px-2 py-0.5">{step.office?.name ?? `Office #${step.office_id}`}</span>
                </span>
            ))}
        </div>
    );
}
