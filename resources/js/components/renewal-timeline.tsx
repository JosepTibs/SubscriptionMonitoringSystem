import { StepIcon, stateStyles, trailStepState } from '@/components/approval-stepper';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate, formatPeso } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type ApprovalRequest } from '@/types';

const statusLabels: Record<string, string> = {
    in_progress: 'In progress',
    completed: 'Completed',
    returned: 'Returned',
    rejected: 'Rejected',
};

export default function RenewalTimeline({ request }: { request?: ApprovalRequest | null }) {
    if (!request) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Approval trail</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground py-6 text-center text-sm">
                        No approval chain — this subscription was entered as already approved.
                    </p>
                </CardContent>
            </Card>
        );
    }

    const steps = [...(request.steps ?? [])].sort((a, b) => a.step_order - b.step_order);
    const currentIndex = steps.findIndex((step) => trailStepState(step, request) === 'current');
    const title = request.type === 'renewal' ? 'Renewal trail' : 'Procurement trail';

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{title}</CardTitle>
                <div className="flex items-center gap-2">
                    {request.flow && <Badge variant="outline">{request.flow.name}</Badge>}
                    <Badge variant="secondary">
                        {request.status === 'in_progress' && currentIndex >= 0
                            ? `At ${steps[currentIndex].office?.name ?? 'Unknown office'} · Step ${currentIndex + 1} of ${steps.length}`
                            : (statusLabels[request.status] ?? request.status)}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent>
                {steps.length === 0 ? (
                    <p className="text-muted-foreground py-6 text-center text-sm">
                        No offices are attached to this approval flow yet.
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <div className="flex min-w-[720px] items-start">
                            {steps.map((step, i) => {
                                const state = trailStepState(step, request);

                                return (
                                    <div key={step.id} className="flex flex-1 items-start last:flex-none">
                                        <div className="flex w-32 flex-col items-center gap-1 text-center">
                                            <span
                                                className={cn(
                                                    'flex size-9 items-center justify-center rounded-full border-2',
                                                    stateStyles[state],
                                                )}
                                            >
                                                <StepIcon state={state} />
                                            </span>
                                            <span className="text-xs font-semibold">{step.office?.name ?? 'Removed office'}</span>
                                            <Badge variant="secondary" className="capitalize">
                                                {step.status}
                                            </Badge>
                                            <span className="text-muted-foreground text-[11px]">
                                                {step.actor ? `Accepted by ${step.actor.name}` : 'Waiting'}
                                            </span>
                                            <span className="text-muted-foreground text-[11px]">
                                                {step.acted_at ? formatDate(step.acted_at) : (step.remarks ?? '—')}
                                            </span>
                                            {step.acted_at && step.remarks && (
                                                <span className="line-clamp-2 text-[11px]">{step.remarks}</span>
                                            )}
                                        </div>
                                        {i < steps.length - 1 && (
                                            <div
                                                className={cn(
                                                    'mx-1 mt-4 h-0.5 flex-1',
                                                    state === 'done' ? 'bg-primary' : 'border-t-2 border-dashed border-muted-foreground/30',
                                                )}
                                            />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {request.type === 'renewal' && request.renewal && (
                    <p className="text-muted-foreground mt-4 text-xs">
                        Proposed renewal: <strong>{formatDate(request.renewal.new_renewal_date)}</strong> ·{' '}
                        <strong>{formatPeso(request.renewal.new_cost)}</strong>
                        {request.renewal.remarks ? ` — ${request.renewal.remarks}` : ''}
                    </p>
                )}

                {request.status === 'returned' && request.remarks && (
                    <p className="text-destructive mt-4 text-xs">Returned: {request.remarks}</p>
                )}
            </CardContent>
        </Card>
    );
}
