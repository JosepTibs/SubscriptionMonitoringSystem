import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate } from '@/lib/format';
import { Check, Circle, LoaderCircle, Undo2 } from 'lucide-react';
import { cn } from 'cn';

type MockStepState = 'done' | 'current' | 'todo' | 'returned';

interface MockStep {
    office: string;
    state: MockStepState;
    actor: string | null;
    actedAt: string | null;
    remarks: string | null;
}

const MOCK_STEPS: MockStep[] = [
    { office: 'Requesting Office', state: 'done', actor: 'J. Cruz', actedAt: '2026-09-10', remarks: 'Papers prepared' },
    { office: 'ICT', state: 'done', actor: 'M. Santos', actedAt: '2026-09-12', remarks: 'Specs verified' },
    { office: 'Budget', state: 'current', actor: 'R. Dela Pena', actedAt: null, remarks: 'Under review' },
    { office: 'Accounting', state: 'todo', actor: null, actedAt: null, remarks: null },
    { office: 'Head', state: 'todo', actor: null, actedAt: null, remarks: null },
];

const stateStyles: Record<MockStepState, string> = {
    done: 'bg-primary text-primary-foreground border-primary',
    current: 'border-primary text-primary ring-2 ring-primary/30 bg-background',
    todo: 'border-muted-foreground/30 text-muted-foreground bg-muted/40',
    returned: 'border-destructive text-destructive bg-destructive/10',
};

function StepIcon({ state }: { state: MockStepState }) {
    if (state === 'done') {
        return <Check className="size-4" />;
    }
    if (state === 'current') {
        return <LoaderCircle className="size-4 animate-spin" />;
    }
    if (state === 'returned') {
        return <Undo2 className="size-4" />;
    }
    return <Circle className="size-4" />;
}

export default function RenewalTimelineMock() {
    const currentIndex = MOCK_STEPS.findIndex((s) => s.state === 'current');

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Renewal trail (mock)</CardTitle>
                <Badge variant="secondary">
                    At {MOCK_STEPS[currentIndex]?.office} · Step {currentIndex + 1} of {MOCK_STEPS.length}
                </Badge>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <div className="flex min-w-[720px] items-start">
                        {MOCK_STEPS.map((step, i) => (
                            <div key={step.office} className="flex flex-1 items-start last:flex-none">
                                <div className="flex w-32 flex-col items-center gap-1 text-center">
                                    <span
                                        className={cn(
                                            'flex size-9 items-center justify-center rounded-full border-2',
                                            stateStyles[step.state],
                                        )}
                                    >
                                        <StepIcon state={step.state} />
                                    </span>
                                    <span className="text-xs font-semibold">{step.office}</span>
                                    <Badge variant="secondary" className="capitalize">
                                        {step.state}
                                    </Badge>
                                    <span className="text-muted-foreground text-[11px]">
                                        {step.actor ? `Accepted by ${step.actor}` : 'Waiting'}
                                    </span>
                                    <span className="text-muted-foreground text-[11px]">
                                        {step.actedAt ? formatDate(step.actedAt) : step.remarks ?? '—'}
                                    </span>
                                    {step.actedAt && step.remarks && (
                                        <span className="line-clamp-2 text-[11px]">{step.remarks}</span>
                                    )}
                                </div>
                                {i < MOCK_STEPS.length - 1 && (
                                    <div
                                        className={cn(
                                            'mx-1 mt-4 h-0.5 flex-1',
                                            step.state === 'done' ? 'bg-primary' : 'border-t-2 border-dashed border-muted-foreground/30',
                                        )}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
                <p className="text-muted-foreground mt-4 text-xs">
                    Mockup only — static data. Real chain + steps props land with the renewal_steps work.
                </p>
            </CardContent>
        </Card>
    );
}
