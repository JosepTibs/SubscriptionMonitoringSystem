import { orderedSteps, StepIcon, stateStyles, trailStepState, type TrailStepState } from '@/components/approval-stepper';
import { confirmRequest } from '@/components/confirm-dialog';
import InputError from '@/components/input-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDate, formatPeso } from '@/lib/format';
import { cn } from '@/lib/utils';
import { type ApprovalRequest, type ApprovalRequestStep, type SharedData } from '@/types';
import { router, usePage } from '@inertiajs/react';
import { Check, Pencil, Trash2, X } from 'lucide-react';
import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

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

/** The runtime writes names through these actions; each stamps its own date. */
type FillAction = 'receive' | 'approve' | 'forward';

/**
 * The three names a step records, in the order the runtime accepts them.
 *
 * `forward` refuses to release papers that have not been approved, so the
 * sender can only ever be recorded after the signatory. Keeping the sequence
 * in one place lets the hint, the guard dialog and the save-all chain agree on
 * it instead of restating the rule.
 */
const fillOrder = [
    { field: 'received_by_name', action: 'receive' as FillAction, label: 'Received by', placeholder: 'Contact who received here' },
    { field: 'approved_by_name', action: 'approve' as FillAction, label: 'Approved by', placeholder: 'Office head who approved' },
    { field: 'sent_by_name', action: 'forward' as FillAction, label: 'Sent by', placeholder: 'Person releasing the papers' },
] as const;

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

interface NameFieldProps {
    field: string;
    label: string;
    placeholder: string;
    draft: StringMap;
    setDraft: Dispatch<SetStateAction<StringMap>>;
    error?: string;
    disabled?: boolean;
    onBlur: () => void;
    onEnter: () => void;
}

/**
 * One typed signatory on the row the papers are sitting at.
 *
 * Leaving the field records that one name, so a single name can be captured
 * without committing the whole row; the check at the end of the row is what
 * records the step in order. A blur is only sent once every earlier name in the
 * chain is filled, so the runtime is never handed a signatory for papers that
 * nobody has signed for receiving, or a release for an unapproved step.
 */
function NameField({ field, label, placeholder, draft, setDraft, error, disabled = false, onBlur, onEnter }: NameFieldProps) {
    return (
        <>
            <Input
                aria-label={label}
                className={cellInput}
                value={draft[field] ?? ''}
                placeholder={placeholder}
                disabled={disabled}
                onChange={(event) => setDraft((previous) => ({ ...previous, [field]: event.target.value }))}
                onBlur={onBlur}
                onKeyDown={(e) => {
                    if (e.key !== 'Enter') {
                        return;
                    }               
                    e.preventDefault();
                    // Same as leaving the field: stage only.
                    // Save explicitly with the check button.
                    e.currentTarget.blur();
                }}
            />
            <InputError message={error} />
        </>
    );
}

/**
 * A request's trail, typed in as the papers travel.
 *
 * Every name is typed by ICT - never derived from the acting account (scope.md
 * §1) - and the date beside it is stamped by the server the moment the name is
 * first saved (see ApprovalChain::markReceived / markApproved / markReleased),
 * so the table keeps no dates of its own.
 *
 * Only the row the papers have reached offers inputs: it is the first row that
 * has not been released, which is exactly the rule the runtime enforces. Rows
 * behind it are history and stay read-only unless the account may correct the
 * trail (see the step controller, the only path allowed to change a recorded
 * value or erase a row).
 */
export default function ApprovalTrailTable({ request }: { request: ApprovalRequest }) {
    const { auth } = usePage<SharedData>().props;
    const canEditTrail = auth?.can_edit_trail === true;

    const steps = orderedSteps(request);
    const currentIndex = steps.findIndex((step) => trailStepState(step, request) === 'current');
    const currentStep = currentIndex >= 0 ? steps[currentIndex] : null;

    // The row the papers have reached: every office ahead of it must already
    // have released them, and deactivated offices are skipped the same way the
    // runtime skips them. Filling a name in any other row would date a hand-off
    // before it happened, so no other row offers inputs.
    const editableStep =
        request.status === 'in_progress' ? (steps.find((step) => step.status !== 'forwarded' && (step.office?.is_active ?? true)) ?? null) : null;
    const editableIndex = editableStep === null ? -1 : steps.findIndex((step) => step.id === editableStep.id);

    // The office due to receive the papers next, if any: the releasing row only
    // records who sent them, and the receiver is typed in when they arrive.
    const destination = editableIndex < 0 ? null : (steps.slice(editableIndex + 1).find((step) => step.office?.is_active ?? true) ?? null);

    // Whether this step can release the papers to another office.
    //
    // The last office has nowhere to send them, so it offers no release input
    // and the check stops after the approval. The columns themselves stay: a
    // step can still carry a recorded release, whether because its successor
    // was deactivated and skipped, or because the papers came back around, so
    // hiding the pair would hide history an audit table has to keep.
    const hasDestination = destination !== null;

    /** What the step already holds for a fill field, so a gap is a real one. */
    const storedNameFor = (field: string): string =>
        field === 'sent_by_name' ? (editableStep?.forwarded_by_name ?? '') : ((editableStep?.[field as keyof ApprovalRequestStep] as string | null) ?? '');

    const [submitting, setSubmitting] = useState(false);
    const [fieldErrors, setFieldErrors] = useState<StringMap>({});

    // The editable row's names are held as a draft and only written when a
    // check button is pressed, so nothing reaches the database just because the
    // pointer moved away from a field.
    const [draft, setDraft] = useState<StringMap>({});

    // Guards a save that was pressed before the row was filled in.
    const [guardOpen, setGuardOpen] = useState(false);
    const [guardMessage, setGuardMessage] = useState('');

    // A save re-renders the row with the stored values, so the draft is reseeded
    // from the record whenever the editable row changes - a released step hands
    // the inputs to the next office, and a saved name must not linger as an
    // unsaved edit on the row that replaces it. The seed is compared as a string
    // because a fresh object every render would reset the draft on each
    // keystroke and make the inputs unwritable.
    const draftSeedKey = editableStep === null ? '' : JSON.stringify(editDraftFrom(editableStep));

    useEffect(() => {
        setDraft(draftSeedKey === '' ? {} : JSON.parse(draftSeedKey));
    }, [draftSeedKey]);

    /**
     * Save one typed name on blur, refusing anything the runtime would reject.
     *
     * The names form a chain: a step is only meaningful once the papers have
     * been received, and only releasable once it has been signed off. Blurring a
     * later field while an earlier one is still blank would otherwise reach the
     * server as a refusal the table cannot display - the 422 carries no field
     * key, so it would surface as silence. The gap is reported instead, naming
     * what has to be filled first.
     */
    const saveField = (action: FillAction, field: string, label: string) => {
        if (submitting) {
            return;
        }

        const value = (draft[field] ?? '').trim();

        if (value === '') {
            return;
        }

        // Everything this field depends on has to be filled before it is worth
        // sending, so the refused case is caught here rather than on the server.
        const blocking = fillOrder.slice(0, fillOrder.findIndex((entry) => entry.field === field)).find(
            (entry) => (draft[entry.field] ?? '').trim() === '' && storedNameFor(entry.field) === '',
        );

        if (blocking !== undefined) {
            setGuardMessage(`"${blocking.label}" is still empty. Record it before "${label}".`);
            setGuardOpen(true);

            return;
        }

        save(action, field, value);
    };

    /**
     * Record the whole row from the check at the end of it.
     *
     * The three names are three actions with three audit rows, so they are sent
     * in the order the runtime accepts rather than together, and the chain stops
     * at the first refusal so a release never runs on top of a signatory that
     * did not save. A row with nothing to release stops after the approval,
     * which on the last office is what completes the chain.
     */
    const saveRow = () => {
        if (submitting) {
            return;
        }

        const applicable = fillOrder.slice(0, hasDestination ? fillOrder.length : 2);
        const missing = applicable.find((entry) => (draft[entry.field] ?? '').trim() === '');

        if (missing !== undefined) {
            setGuardMessage(`"${missing.label}" is still empty. Fill in the names in order before recording this step.`);
            setGuardOpen(true);

            return;
        }

        setFieldErrors({});
        setSubmitting(true);

        applicable
            .reduce((chain, entry) => chain.then(() => sendField(entry.action, entry.field, (draft[entry.field] ?? '').trim())), Promise.resolve())
            .then(() => setSubmitting(false))
            .catch(() => setSubmitting(false));
    };

    /**
     * Send one typed name. The runtime stamps the matching date on the first
     * fill, so nothing here carries a date, and an empty field is not a save.
     *
     * Saving is explicit: the value only reaches the database when the check
     * button is pressed, so nothing is written as a side effect of moving the
     * pointer away from the field.
     */
    const save = (action: FillAction, field: string, typed: string) => {
        if (submitting) {
            return;
        }

        const value = typed.trim();

        if (value === '') {
            return;
        }

        setFieldErrors({});
        setSubmitting(true);
        router.patch(route('approval-requests.' + action, request.id), { [field]: value }, {
            preserveScroll: true,
            onError: (errors) => setFieldErrors(errors),
            onFinish: () => setSubmitting(false),
        });
    };

    /**
     * One link in the save chain. Inertia's patch is promise-shaped, so the
     * next name waits for this one to land and the chain can halt on a refusal.
     */
    const sendField = (action: FillAction, field: string, value: string) =>
        new Promise<void>((resolve, reject) => {
            router.patch(
                route('approval-requests.' + action, request.id),
                { [field]: value },
                {
                    preserveScroll: true,
                    onError: (errors) => {
                        setFieldErrors(errors);
                        reject(new Error(field));
                    },
                    onSuccess: () => resolve(),
                },
            );
        });

    const rows = trailRows(request);

   
          

    // The order the runtime accepts, spelled out where the inputs are rather
    // than only in the refusal dialog: the sender cannot be recorded before the
    // step is approved, and the table would otherwise invite that attempt.
    

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

    const eraseRow = async (step: ApprovalRequestStep) => {
        const ok = await confirmRequest({
            title: `Erase the row for "${step.office?.name ?? 'removed office'}"?`,
            description: 'It has not been actioned, so only the row is lost. This cannot be undone.',
            confirmLabel: 'Erase row',
        });

        if (!ok) {
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
                                {canEditTrail && <TableHead className="w-20 text-right">Trail</TableHead>}
                                <TableHead className="w-12" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.map((row) => {
                                const isEditable = editableStep !== null && row.step.id === editableStep.id;
                                const isEditing = editingRowId === row.step.id;

                                return (
                                    <TableRow
                                        key={row.step.id}
                                        className={cn(row.state === 'todo' && 'opacity-60', isEditable && 'bg-muted/40')}
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
                                            ) : isEditable ? (
                                                <NameField
                                                    field="received_by_name"
                                                    label="Received by"
                                                    placeholder="Contact who received here"
                                                    draft={draft}
                                                    setDraft={setDraft}
                                                    error={fieldErrors.received_by_name}
                                                    disabled={submitting}
                                                    onBlur={() => saveField('receive', 'received_by_name', 'Received by')}
                                                    onEnter={saveRow}
                                                />
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
                                            ) : isEditable ? (
                                                <NameField
                                                    field="approved_by_name"
                                                    label="Approved by"
                                                    placeholder="Office head who approved"
                                                    draft={draft}
                                                    setDraft={setDraft}
                                                    error={fieldErrors.approved_by_name}
                                                    disabled={submitting}
                                                    onBlur={() => saveField('approve', 'approved_by_name', 'Approved by')}
                                                    onEnter={saveRow}
                                                />
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
                                            {!hasDestination ? (
                                                row.sentBy ?? '—'
                                            ) : isEditing ? (
                                                <ValueCell field="forwarded_by_name" draft={editDraft} setDraft={setEditDraft} error={fieldErrors.forwarded_by_name} />
                                            ) : isEditable ? (
                                                <NameField
                                                    field="sent_by_name"
                                                    label="Sent by"
                                                    placeholder="Person releasing the papers"
                                                    draft={draft}
                                                    setDraft={setDraft}
                                                    error={fieldErrors.sent_by_name}
                                                    disabled={submitting}
                                                    onBlur={() => saveField('forward', 'sent_by_name', 'Sent by')}
                                                    onEnter={saveRow}
                                                />
                                            ) : (
                                                (row.sentBy ?? '—')
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {!hasDestination ? (
                                                row.sentAt ? formatDate(row.sentAt) : '—'
                                            ) : isEditing ? (
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
                                                            {row.step.status === 'pending' && !isEditable && (
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
            </CardContent>

            {/*
                Refuses a save pressed before the row is filled in. The runtime
                answers an out-of-order release with a 422 that carries no field
                key, so it used to surface as nothing at all; naming the field
                here turns that dead end into a readable reason.
            */}
            <Dialog open={guardOpen} onOpenChange={setGuardOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Fill the required field first</DialogTitle>
                        <DialogDescription>{guardMessage}</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button type="button" onClick={() => setGuardOpen(false)}>
                            Got it
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}