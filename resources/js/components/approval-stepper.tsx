import { cn } from '@/lib/utils';
import { type ApprovalRequest, type ApprovalRequestStep } from '@/types';
import { Check, Circle, LoaderCircle, Undo2 } from 'lucide-react';

export type TrailStepState = 'done' | 'current' | 'todo' | 'returned';

export const stateStyles: Record<TrailStepState, string> = {
    done: 'bg-primary text-primary-foreground border-primary',
    current: 'border-primary text-primary ring-2 ring-primary/30 bg-background',
    todo: 'border-muted-foreground/30 text-muted-foreground bg-muted/40',
    returned: 'border-destructive text-destructive bg-destructive/10',
};

const chipStyles: Record<TrailStepState, string> = {
    done: 'bg-primary/10 text-primary',
    current: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    todo: 'bg-muted text-muted-foreground',
    returned: 'bg-destructive/10 text-destructive',
};

export function trailStepState(step: ApprovalRequestStep, request: ApprovalRequest): TrailStepState {
    if (step.status === 'returned') {
        return 'returned';
    }

    if (step.status === 'approved' || step.status === 'forwarded') {
        return 'done';
    }

    if (step.status === 'received') {
        return 'current';
    }

    return request.status === 'in_progress' && step.office_id === request.current_office_id ? 'current' : 'todo';
}

export function StepIcon({ state, className }: { state: TrailStepState; className?: string }) {
    const classes = className ?? 'size-4';

    if (state === 'done') {
        return <Check className={classes} />;
    }

    if (state === 'current') {
        return <LoaderCircle className={cn(classes, 'animate-spin')} />;
    }

    if (state === 'returned') {
        return <Undo2 className={classes} />;
    }

    return <Circle className={classes} />;
}

export function orderedSteps(request: ApprovalRequest): ApprovalRequestStep[] {
    return [...(request.steps ?? [])].sort((a, b) => a.step_order - b.step_order);
}

export function currentStepOf(request: ApprovalRequest): ApprovalRequestStep | null {
    return orderedSteps(request).find((step) => step.office_id === request.current_office_id) ?? null;
}

/**
 * Compact trail preview for tables and queues.
 */
export default function ApprovalStepper({ request }: { request: ApprovalRequest }) {
    const steps = orderedSteps(request);

    if (steps.length === 0) {
        return <span className="text-muted-foreground text-sm">No steps</span>;
    }

    return (
        <div className="flex flex-wrap items-center gap-1 text-sm">
            {steps.map((step, index) => {
                const state = trailStepState(step, request);

                return (
                    <span key={step.id} className="flex items-center gap-1">
                        {index > 0 && <span className="text-muted-foreground">&rarr;</span>}
                        <span className={cn('flex items-center gap-1 rounded px-2 py-0.5', chipStyles[state])}>
                            <StepIcon state={state} className="size-3" />
                            {step.office?.name ?? `Office #${step.office_id}`}
                        </span>
                    </span>
                );
            })}
        </div>
    );
}