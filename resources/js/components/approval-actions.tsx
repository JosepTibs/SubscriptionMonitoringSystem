import { currentStepOf } from '@/components/approval-stepper';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { type ApprovalRequest } from '@/types';
import { router } from '@inertiajs/react';
import { Check, Forward, Undo2 } from 'lucide-react';
import { FormEventHandler, useState } from 'react';

type ApprovalAction = 'approve' | 'forward' | 'return';

const actionCopy = {
  approve: { title: 'Record approval', description: 'Signs off. Stays here until forwarded.', confirm: 'Record Approval' },
  forward: { title: 'Forward to next office', description: 'Moves on. Inactive offices are skipped.', confirm: 'Forward' },
  return: { title: 'Return the request', description: 'Chain stops so the office can act again. Remarks required.', confirm: 'Return Request' },
};

const textareaClassName = 'border-input flex min-h-16 w-full rounded-lg border px-3 py-2 text-sm';

export default function ApprovalActions({ request }: { request?: ApprovalRequest | null }) {
  const [action, setAction] = useState<ApprovalAction | null>(null);
  const [remarks, setRemarks] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  if (request == null) { return null; }
  if (request.status !== 'in_progress') { return null; }

  const step = currentStepOf(request);

  let canApprove = false;
  if (step != null) {
    if (step.status === 'pending') { canApprove = true; }
    if (step.status === 'received') { canApprove = true; }
    if (step.status === 'returned') { canApprove = true; }
  }

  let canForward = false;
  if (step != null) {
    if (step.status === 'approved') { canForward = true; }
  }

  const openDialog = (next: ApprovalAction) => { setError(''); setRemarks(''); setAction(next); };
  const closeDialog = () => { setAction(null); };

  const submitForm: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    if (action == null) { return; }
    setProcessing(true);
    setError('');
    const url = route('approval-requests.' + action, request.id);
    router.patch(url, { remarks: remarks }, {
      preserveScroll: true,
      onError: (errors) => { setError('Unable to record this action.'); },
      onSuccess: () => { setAction(null); setRemarks(''); },
      onFinish: () => { setProcessing(false); },
    });
  };

  return (
    <>
      <div className='flex flex-wrap items-center gap-2'>
        <Button size='sm' onClick={() => openDialog('approve')} disabled={!canApprove}>
          <Check className='h-4 w-4' /> Approve
        </Button>
        <Button size='sm' variant='outline' onClick={() => openDialog('forward')} disabled={!canForward}>
          <Forward className='h-4 w-4' /> Forward
        </Button>
        <Button size='sm' variant='destructive' onClick={() => openDialog('return')}>
          <Undo2 className='h-4 w-4' /> Return
        </Button>
        {canForward ? <span className='text-muted-foreground text-xs'>Signed off, forward it or return it.</span> : null}
      </div>
      <Dialog open={action !== null} onOpenChange={(isOpen) => { if (isOpen === false) { setAction(null); } }}>
        <DialogContent>
          {action !== null ? (
            <form onSubmit={submitForm} className='grid gap-4'>
              <DialogHeader>
                <DialogTitle>{actionCopy[action].title}</DialogTitle>
                <DialogDescription>{actionCopy[action].description}</DialogDescription>
              </DialogHeader>
              <div className='grid gap-2'>
                <Label htmlFor='approval-remarks'>Remarks</Label>
                <textarea
                  id='approval-remarks'
                  className={textareaClassName}
                  value={remarks}
                  onChange={(event) => setRemarks(event.target.value)}
                  placeholder='Notes recorded on the trail'
                />
                <InputError message={error} />
              </div>
              <DialogFooter>
                <Button type='button' variant='outline' onClick={closeDialog} disabled={processing}>Cancel</Button>
                <Button type='submit' disabled={processing}>{actionCopy[action].confirm}</Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
