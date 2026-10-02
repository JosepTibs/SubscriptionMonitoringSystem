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
}

const actionCopy: Record<ApprovalAction, ActionCopy> = {
    approve: {
        title: 'Record approval',
        description: 'Signs off. Stays here until released. Name the office head who approved.',
        confirm: 'Record Approval',
        nameField: 'approved_by_name',
        nameLabel: 'Approved by',
        namePlaceholder: 'Office head who approved',
    },
    forward: {
        title: 'Release to the next office',
        description: 'Releases the papers. Inactive offices are skipped. Name who is releasing them here — the next office records its own receiver when the papers reach it.',
        confirm: 'Release',
        nameField: 'sent_by_name',
        nameLabel: 'Sent by',
        namePlaceholder: 'Person releasing the papers from this office',
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

export default function ApprovalActions({ request }: { request?: ApprovalRequest | null }) {
    const [action, setAction] = useState<ApprovalAction | null>(null);
    const [signatoryName, setSignatoryName] = useState('');
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

    // The buttons stay available whatever the step's state: the runtime answers
    // with the real reason (422) when a step is not at that point yet and the
    // dialog shows the message. Only the hint below is state-aware.
    const canForward = step?.status === 'approved';

    const openDialog = (next: ApprovalAction) => {
        setError('');
        setFieldErrors({});
        setSignatoryName('');
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
        const { nameField } = actionCopy[action];
        router.patch(
            url,
            { [nameField]: signatoryName },
            {
                preserveScroll: true,
                onError: (errors) => {
                    // Surface the real field messages; the generic line is only a fallback.
                    setFieldErrors(errors);
                    setError(Object.keys(errors).length === 0 ? 'Unable to record this action.' : '');
                },
                onSuccess: () => {
                    setAction(null);
                    setSignatoryName('');
                },
                onFinish: () => {
                    setProcessing(false);
                },
            },
        );
    };

    const nameError = action != null ? (fieldErrors[actionCopy[action].nameField] ?? '') : '';

    return (
        <>
            <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={() => openDialog('approve')}>
                    <Check className="h-4 w-4" /> Approve
                </Button>
                <Button size="sm" variant="outline" onClick={() => openDialog('forward')}>
                    <Forward className="h-4 w-4" /> Release
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
                                />
                                <InputError message={nameError !== '' ? nameError : error} />
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
