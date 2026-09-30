import { currentStepOf } from '@/components/approval-stepper';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type ApprovalRequest } from '@/types';
import { router } from '@inertiajs/react';
import { Check, Forward, Undo2 } from 'lucide-react';
import { useState } from 'react';

type ApprovalAction = 'approve' | 'forward' | 'return';

interface ActionCopy {
    title: string;
    description: string;
    confirm: string;
    nameField: string;
    nameLabel: string;
    namePlaceholder: string;
    /** Second typed name, only where the person releasing the papers can differ. */
    senderField?: string;
    senderLabel?: string;
    senderPlaceholder?: string;
}

const actionCopy: Record<ApprovalAction, ActionCopy> = {
    approve: {
        title: 'Record approval',
        description: 'Signs off. Stays here until forwarded. Name the office head who approved.',
        confirm: 'Record Approval',
        nameField: 'approved_by_name',
        nameLabel: 'Approved by',
        namePlaceholder: 'Office head who approved',
    },
    forward: {
        title: 'Forward to next office',
        description: 'Moves on. Inactive offices are skipped. Name who is releasing the papers here and the contact receiving them there.',
        confirm: 'Forward',
        nameField: 'received_by_name',
        nameLabel: 'Received by',
        namePlaceholder: 'Contact at the next office',
        senderField: 'sent_by_name',
        senderLabel: 'Sent by',
        senderPlaceholder: 'Person releasing the papers from this office',
    },
    return: {
        title: 'Return the request',
        description: 'Chain stops so the office can act again. Name who sent it back.',
        confirm: 'Return Request',
        nameField: 'approved_by_name',
        nameLabel: 'Returned by',
        namePlaceholder: 'Who sent it back',
    },
};

const textareaClassName = 'border-input flex min-h-16 w-full rounded-lg border px-3 py-2 text-sm';

export default function ApprovalActions({ request }: { request?: ApprovalRequest | null }) {
    const [action, setAction] = useState<ApprovalAction | null>(null);
    const [remarks, setRemarks] = useState('');
    const [signatoryName, setSignatoryName] = useState('');
    const [senderName, setSenderName] = useState('');
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    if (request == null) {
        return null;
    }
    if (request.status !== 'in_progress') {
        return null;
    }

    const step = currentStepOf(request);

    let canApprove = false;
    if (step != null) {
        if (step.status === 'pending') {
            canApprove = true;
        }
        if (step.status === 'received') {
            canApprove = true;
        }
        if (step.status === 'returned') {
            canApprove = true;
        }
    }

    let canForward = false;
    if (step != null) {
        if (step.status === 'approved') {
            canForward = true;
        }
    }

    const openDialog = (next: ApprovalAction) => {
        setError('');
        setFieldErrors({});
        setRemarks('');
        setSignatoryName('');
        setSenderName('');
        setAction(next);
    };
    const closeDialog = () => {
        setAction(null);
    };

    const submitForm: React.FormEventHandler<HTMLFormElement> = (event) => {
        event.preventDefault();
        if (action == null) {
            return;
        }
        setProcessing(true);
        setError('');
        setFieldErrors({});
        const url = route('approval-requests.' + action, request.id);
        const { nameField, senderField } = actionCopy[action];
        const sentBy = senderField != null ? { [senderField]: senderName } : {};
        router.patch(
            url,
            { remarks: remarks, [nameField]: signatoryName, ...sentBy },
            {
                preserveScroll: true,
                onError: (errors) => {
                    // Surface the real field messages; the generic line is only a fallback.
                    setFieldErrors(errors);
                    setError(Object.keys(errors).length === 0 ? 'Unable to record this action.' : '');
                },
                onSuccess: () => {
                    setAction(null);
                    setRemarks('');
                    setSignatoryName('');
                    setSenderName('');
                },
                onFinish: () => {
                    setProcessing(false);
                },
            },
        );
    };

    const nameError = action != null ? (fieldErrors[actionCopy[action].nameField] ?? '') : '';
    const senderError = action != null && actionCopy[action].senderField != null ? (fieldErrors[actionCopy[action].senderField] ?? '') : '';
    const remarksError = fieldErrors.remarks ?? '';

    return (
        <>
            <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={() => openDialog('approve')} disabled={!canApprove}>
                    <Check className="h-4 w-4" /> Approve
                </Button>
                <Button size="sm" variant="outline" onClick={() => openDialog('forward')} disabled={!canForward}>
                    <Forward className="h-4 w-4" /> Forward
                </Button>
                <Button size="sm" variant="destructive" onClick={() => openDialog('return')}>
                    <Undo2 className="h-4 w-4" /> Return
                </Button>
                {canForward ? <span className="text-muted-foreground text-xs">Signed off, forward it or return it.</span> : null}
            </div>
            <Dialog
                open={action !== null}
                onOpenChange={(isOpen) => {
                    if (isOpen === false) {
                        setAction(null);
                    }
                }}
            >
                <DialogContent>
                    {action !== null ? (
                        <form onSubmit={submitForm} className="grid gap-4">
                            <DialogHeader>
                                <DialogTitle>{actionCopy[action].title}</DialogTitle>
                                <DialogDescription>{actionCopy[action].description}</DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-2">
                                <Label htmlFor="approval-signatory">{actionCopy[action].nameLabel}</Label>
                                <Input
                                    id="approval-signatory"
                                    value={signatoryName}
                                    onChange={(event) => setSignatoryName(event.target.value)}
                                    placeholder={actionCopy[action].namePlaceholder}
                                    required
                                />
                                <InputError message={nameError} />
                            </div>
                            {actionCopy[action].senderField != null ? (
                                <div className="grid gap-2">
                                    <Label htmlFor="approval-sender">{actionCopy[action].senderLabel}</Label>
                                    <Input
                                        id="approval-sender"
                                        value={senderName}
                                        onChange={(event) => setSenderName(event.target.value)}
                                        placeholder={actionCopy[action].senderPlaceholder}
                                        required
                                    />
                                    <InputError message={senderError} />
                                </div>
                            ) : null}
                            <div className="grid gap-2">
                                <Label htmlFor="approval-remarks">Remarks</Label>
                                <textarea
                                    id="approval-remarks"
                                    className={textareaClassName}
                                    value={remarks}
                                    onChange={(event) => setRemarks(event.target.value)}
                                    placeholder="Notes recorded on the trail"
                                />
                                <InputError message={remarksError !== '' ? remarksError : error} />
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={closeDialog} disabled={processing}>
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={processing}>
                                    {actionCopy[action].confirm}
                                </Button>
                            </DialogFooter>
                        </form>
                    ) : null}
                </DialogContent>
            </Dialog>
        </>
    );
}
