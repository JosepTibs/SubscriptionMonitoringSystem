import { orderedSteps, StepIcon, stateStyles, trailStepState, type TrailStepState } from '@/components/approval-stepper';
import InputError from '@/components/input-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDate, formatPeso } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type ApprovalRequest, type ApprovalRequestStep, type SharedData } from '@/types';
import { router, usePage } from '@inertiajs/react';
import { Check, Pencil, Trash2, X } from 'lucide-react';
import { useRef, useState, type Dispatch, type SetStateAction } from 'react';

const statusLabels: Record<string, string> = {
    in_progress: 'In progress',
    completed: 'Completed',
    returned: 'Returned',
    rejected: 'Rejected',
};

const statusVariants: Record<TrailStepState, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    done: 'default',
    current: 'secondary',
    returned: 'destructive',
    todo: 'outline',
};

const cellInput = 'h-8 text-sm';

/** The transition the step holding the papers is waiting on. */
type FillAction = 'approve' | 'forward';

type StringMap = Record<string, string>;

interface TrailRow {
    step: ApprovalRequestStep;
    state: TrailStepState;
    receivedBy: string | null;
    receivedAt: string | null;
    approvedBy: string | null;
    approvedAt: string | null;
    sentBy: string | null;
    sentAt: string | null;
}

/**
 * One auditable row per office the papers passed through.
 *
 * Only names typed by ICT are shown (scope.md section 1): the acting account is
 * never substituted for the people at an office. "Sent" is the release event —
 * the typed sender when one was recorded, otherwise the signatory who let the
 * papers go (rows forwarded before the sent columns existed).
 */
function trailRows(request: ApprovalRequest): TrailRow[] {
    return orderedSteps(request).map((step) => {
        const state = trailStepState(step, request);
        const decided = state === 'done' || state === 'returned';

        return {
            step,
            state,
            receivedBy: step.received_by_name,
            receivedAt: step.received_at,
            approvedBy: decided ? step.approved_by_name : null,
            approvedAt: decided ? step.acted_at : null,
            sentBy: step.forwarded_by_name ?? (step.status === 'forwarded' ? step.approved_by_name : null),
            sentAt: step.forwarded_at,
        };
    });
}

function waitingDays(receivedAt: string): number {
    return Math.max(0, Math.floor((Date.now() - new Date(receivedAt).getTime()) / 86_400_000));
}

/** The date-only shape an <input type="date"> needs. */
function dateInputValue(value: string | null): string {
    return value ? value.slice(0, 10) : '';
}

const editDraftFrom = (step: ApprovalRequestStep): StringMap => ({
    received_by_name: step.received_by_name ?? '',
    received_at: dateInputValue(step.received_at),
    approved_by_name: step.approved_by_name ?? '',
    acted_at: dateInputValue(step.acted_at),
    forwarded_by_name: step.forwarded_by_name ?? '',
    forwarded_at: dateInputValue(step.forwarded_at),
    remarks: step.remarks ?? '',
});

interface ValueCellProps {
    field: string;
    draft: StringMap;
    setDraft: Dispatch<SetStateAction<StringMap>>;
    type?: 'text' | 'date';
    error?: string;
}

/** One editable cell in a row that an administrator has unlocked for correction. */
function ValueCell({ field, draft, setDraft, type = 'text', error }: ValueCellProps) {
    return (
        <>
            <Input
                type={type}
                className={cellInput}
                value={draft[field] ?? ''}
                onChange={(event) => setDraft((previous) => ({ ...previous, [field]: event.target.value }))}
            />
            <InputError message={error} />
        </>
    );
}

/**
 * A request's trail, editable in place.
 *
 * The step holding the papers shows inputs for the transition it is waiting
 * on: completing the typed names commits the action on its own. Every date is
 * stamped by the server at that moment — never typed here. Recorded rows stay
 * read-only unless the account may edit the trail (see the step controller,
 * the only path allowed to change a recorded value or erase a row).
 */
export default function ApprovalTrailTable({ request }: { request: ApprovalRequest }) {
    const { auth } = usePage<SharedData>().props;
    const canEditTrail = auth?.can_edit_trail === true;

    const steps = orderedSteps(request);
    const currentIndex = steps.findIndex((step) => trailStepState(step, request) === 'current');
    const currentStep = currentIndex >= 0 ? steps[currentIndex] : null;

    // The runtime skips deactivated offices, so the row due to receive the
    // papers is the next one whose office is still active.
    const nextStep = currentStep === null ? null : (steps.slice(currentIndex + 1).find((step) => step.office?.is_active ?? true) ?? null);

    // Which transition the current step is waiting on, if any.
    const fillAction: FillAction | null =
        request.status !== 'in_progress' || currentStep === null
            ? null
            : currentStep.status === 'approved'
              ? 'forward'
              : ['pending', 'received', 'returned'].includes(currentStep.status)
                ? 'approve'
                : null;

    const [draft, setDraft] = useState({ approved_by_name: '', sent_by_name: '', received_by_name: '', remarks: '' });
    const [submitting, setSubmitting] = useState(false);
    const [fieldErrors, setFieldErrors] = useState<StringMap>({});
    // An inline form has no submit button, so the commit fires from a blur;
    // this stops the same values being sent twice.
    const lastAttempt = useRef('');

    const setDraftValue = (key: keyof typeof draft) => (value: string) => {
        setDraft((previous) => ({ ...previous, [key]: value }));
    };

    const post = (action: string, payload: StringMap) => {
        if (submitting) {
            return;
        }

        setSubmitting(true);
        router.patch(route('approval-requests.' + action, request.id), payload, {
            preserveScroll: true,
            onError: (errors) => setFieldErrors(errors),
            onFinish: () => setSubmitting(false),
        });
    };

    const rows = trailRows(request);
    const fillHint =
        fillAction === null
            ? 'Every row records who received and who released the papers at that office.'
            : fillAction === 'approve'
              ? 'Type who approved at the highlighted office — the approval is written as soon as the name is filled in.'
              : nextStep === null
                ? 'Type who released the papers — the chain completes as soon as the name is filled in.'
                : 'Type who released the papers here and who receives them at the next office — the hand-off is written as soon as both are filled in.';

    /** Commits the pending transition once the names it needs are all typed. */
    const commitFill = () => {
        if (fillAction === null) {
            return;
        }

        // Completeness is checked against the typed draft, not the payload, so
        // TypeScript never has to read keys off a union of differently shaped objects.
        const needsReceiver = nextStep !== null;
        const complete =
            fillAction === 'approve'
                ? draft.approved_by_name.trim() !== ''
                : draft.sent_by_name.trim() !== '' && (!needsReceiver || draft.received_by_name.trim() !== '');

        if (!complete) {
            return;
        }

        const payload: StringMap =
            fillAction === 'approve'
                ? { approved_by_name: draft.approved_by_name, remarks: draft.remarks }
                : {
                      sent_by_name: draft.sent_by_name,
                      received_by_name: needsReceiver ? draft.received_by_name : '',
                      remarks: draft.remarks,
                  };

        const signature = JSON.stringify(payload);
        if (lastAttempt.current === signature) {
            return;
        }
        lastAttempt.current = signature;
        post(fillAction, payload);
    };

    const sendBack = () => {
        post('return', { approved_by_name: draft.approved_by_name, remarks: draft.remarks });
    };

    // Administrative corrections: one recorded row unlocked at a time.
    const [editingRowId, setEditingRowId] = useState<number | null>(null);
    const [editDraft, setEditDraft] = useState<StringMap>({});

    const startEditing = (step: ApprovalRequestStep) => {
        setFieldErrors({});
        setEditingRowId(step.id);
        setEditDraft(editDraftFrom(step));
    };

    const saveEdit = () => {
        if (editingRowId === null) {
            return;
        }
        router.patch(route('approval-request-steps.update', editingRowId), editDraft, {
            preserveScroll: true,
            onError: (errors) => setFieldErrors(errors),
            onSuccess: () => setEditingRowId(null),
        });
    };

    const eraseRow = (step: ApprovalRequestStep) => {
        if (!window.confirm(`Erase the row for "${step.office?.name ?? 'removed office'}"? It has not been actioned, so only the row is lost.`)) {
            return;
        }
        router.delete(route('approval-request-steps.destroy', step.id), { preserveScroll: true });
    };

    return (
        <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
                <CardTitle>{request.type === 'renewal' ? 'Renewal audit trail' : 'Procurement audit trail'}</CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                    {request.flow && <Badge variant="outline">{request.flow.name}</Badge>}
                    <Badge variant={request.status === 'completed' ? 'default' : 'secondary'}>
                        {request.status === 'in_progress' && currentStep !== null
                            ? `At ${currentStep.office?.name ?? 'Unknown office'} · Step ${currentIndex + 1} of ${steps.length}`
                            : (statusLabels[request.status] ?? request.status)}
                    </Badge>
                    {submitting && <span className="text-muted-foreground text-xs">Saving…</span>}
                </div>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground mb-2 text-xs">{fillHint}</p>
                <div className="overflow-x-auto">
                    <Table className="min-w-250">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-12">#</TableHead>
                                <TableHead>Office</TableHead>
                                <TableHead>Received by</TableHead>
                                <TableHead>Date received</TableHead>
                                <TableHead>Approved by</TableHead>
                                <TableHead>Date approved</TableHead>
                                <TableHead>Sent by</TableHead>
                                <TableHead>Date sent</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Remarks</TableHead>
                                {canEditTrail && <TableHead className="w-20 text-right">Trail</TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.map((row) => {
                                const isCurrent = currentStep !== null && row.step.id === currentStep.id;
                                const isReceiver = nextStep !== null && row.step.id === nextStep.id;
                                const isEditing = editingRowId === row.step.id;
                                const fillReceived = isReceiver && fillAction === 'forward';
                                const fillApproved = isCurrent && fillAction === 'approve';
                                const fillSent = isCurrent && fillAction === 'forward';
                                const fillRemarks = isCurrent && fillAction !== null;

                                return (
                                    <TableRow
                                        key={row.step.id}
                                        className={cn(row.state === 'todo' && 'opacity-60', (isCurrent || fillReceived) && 'bg-muted/40')}
                                    >
                                        <TableCell className="font-medium">{row.step.step_order}</TableCell>
                                        <TableCell>
                                            <span className="flex items-center gap-2">
                                                <span
                                                    className={cn('flex size-6 shrink-0 items-center justify-center rounded-full border-2', stateStyles[row.state])}
                                                >
                                                    <StepIcon state={row.state} className="size-3" />
                                                </span>
                                                <span className="font-medium">{row.step.office?.name ?? 'Removed office'}</span>
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            {isEditing ? (
                                                <ValueCell field="received_by_name" draft={editDraft} setDraft={setEditDraft} error={fieldErrors.received_by_name} />
                                            ) : fillReceived ? (
                                                <>
                                                    <Input
                                                        className={cellInput}
                                                        value={draft.received_by_name}
                                                        placeholder="Contact receiving here"
                                                        onChange={(event) => setDraftValue('received_by_name')(event.target.value)}
                                                        onBlur={commitFill}
                                                    />
                                                    <InputError message={fieldErrors.received_by_name} />
                                                </>
                                            ) : (
                                                (row.receivedBy ?? '—')
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {isEditing ? (
                                                <ValueCell field="received_at" draft={editDraft} setDraft={setEditDraft} type="date" error={fieldErrors.received_at} />
                                            ) : row.receivedAt ? (
                                                formatDate(row.receivedAt)
                                            ) : (
                                                '—'
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {isEditing ? (
                                                <ValueCell field="approved_by_name" draft={editDraft} setDraft={setEditDraft} error={fieldErrors.approved_by_name} />
                                            ) : fillApproved ? (
                                                <>
                                                    <Input
                                                        className={cellInput}
                                                        value={draft.approved_by_name}
                                                        placeholder="Office head who approved"
                                                        onChange={(event) => setDraftValue('approved_by_name')(event.target.value)}
                                                        onBlur={commitFill}
                                                    />
                                                    <InputError message={fieldErrors.approved_by_name} />
                                                </>
                                            ) : (
                                                (row.approvedBy ?? '—')
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {isEditing ? (
                                                <ValueCell field="acted_at" draft={editDraft} setDraft={setEditDraft} type="date" error={fieldErrors.acted_at} />
                                            ) : row.approvedAt ? (
                                                formatDate(row.approvedAt)
                                            ) : (
                                                '—'
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {isEditing ? (
                                                <ValueCell field="forwarded_by_name" draft={editDraft} setDraft={setEditDraft} error={fieldErrors.forwarded_by_name} />
                                            ) : fillSent ? (
                                                <>
                                                    <Input
                                                        className={cellInput}
                                                        value={draft.sent_by_name}
                                                        placeholder="Person releasing the papers"
                                                        onChange={(event) => setDraftValue('sent_by_name')(event.target.value)}
                                                        onBlur={commitFill}
                                                    />
                                                    <InputError message={fieldErrors.sent_by_name} />
                                                </>
                                            ) : (
                                                (row.sentBy ?? '—')
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {isEditing ? (
                                                <ValueCell field="forwarded_at" draft={editDraft} setDraft={setEditDraft} type="date" error={fieldErrors.forwarded_at} />
                                            ) : row.sentAt ? (
                                                formatDate(row.sentAt)
                                            ) : (
                                                '—'
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col items-start gap-1">
                                                <Badge variant={statusVariants[row.state]} className="capitalize">
                                                    {row.step.status}
                                                </Badge>
                                                {row.state === 'current' && row.receivedAt && (
                                                    <span className="text-muted-foreground text-[11px]">{`Still here · ${waitingDays(row.receivedAt)} day(s)`}</span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {isEditing ? (
                                                <ValueCell field="remarks" draft={editDraft} setDraft={setEditDraft} error={fieldErrors.remarks} />
                                            ) : fillRemarks ? (
                                                <>
                                                    <Input
                                                        className={cellInput}
                                                        value={draft.remarks}
                                                        placeholder="Notes recorded on the trail"
                                                        onChange={(event) => setDraftValue('remarks')(event.target.value)}
                                                        onBlur={commitFill}
                                                    />
                                                    <InputError message={fieldErrors.remarks} />
                                                </>
                                            ) : (
                                                <span className="text-muted-foreground text-sm">{row.step.remarks ?? '—'}</span>
                                            )}
                                            {fillRemarks && draft.remarks !== '' && (
                                                <Button type="button" variant="ghost" size="sm" className="mt-1" onClick={sendBack}>
                                                    Record a return instead
                                                </Button>
                                            )}
                                        </TableCell>
                                        {canEditTrail && (
                                            <TableCell>
                                                <div className="flex items-center justify-end gap-1">
                                                    {isEditing ? (
                                                        <>
                                                            <Button type="button" variant="ghost" size="sm" onClick={saveEdit} title="Save corrections">
                                                                <Check className="h-4 w-4" />
                                                            </Button>
                                                            <Button type="button" variant="ghost" size="sm" onClick={() => setEditingRowId(null)} title="Discard">
                                                                <X className="h-4 w-4" />
                                                            </Button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Button type="button" variant="ghost" size="sm" onClick={() => startEditing(row.step)} title="Correct this row">
                                                                <Pencil className="h-4 w-4" />
                                                            </Button>
                                                            {row.step.status === 'pending' && !isCurrent && (
                                                                <Button type="button" variant="ghost" size="sm" onClick={() => eraseRow(row.step)} title="Erase this row">
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </TableCell>
                                        )}
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
                {request.type === 'renewal' && request.renewal && (
                    <p className="text-muted-foreground mt-4 text-xs">
                        Proposed renewal: <strong>{formatDate(request.renewal.new_renewal_date)}</strong> · <strong>{formatPeso(request.renewal.new_cost)}</strong>
                        {request.renewal.remarks ? ` — ${request.renewal.remarks}` : ''}
                    </p>
                )}
                {request.status === 'returned' && request.remarks && <p className="text-destructive mt-4 text-xs">Returned: {request.remarks}</p>}
            </CardContent>
        </Card>
    );
}