import { Button } from '@/components/ui/button';
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { type ApprovalFlow, type Office } from '@/types';
import { useForm } from '@inertiajs/react';
import { type FormEventHandler } from 'react';
import FlowForm, { type FlowFormData } from './flow-form';

interface FlowFormSheetProps {
    /** The flow being edited; omit for create mode. */
    flow?: ApprovalFlow;
    offices: Office[];
    onClose: () => void;
}

export default function FlowFormSheet({ flow, offices, onClose }: FlowFormSheetProps) {
    const isEdit = flow !== undefined;

    const { data, setData, post, patch, processing, errors } = useForm<FlowFormData>({
        name: flow?.name ?? '',
        description: flow?.description ?? '',
        steps: flow ? flow.steps.map((step) => String(step.office_id)) : [],
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        const options = { onSuccess: onClose };

        if (isEdit && flow) {
            patch(route('approval-flows.update', flow.id), options);
            return;
        }

        post(route('approval-flows.store'), options);
    };

    return (
        <Sheet
            open
            onOpenChange={(open) => {
                if (!open) {
                    onClose();
                }
            }}
        >
            <SheetContent side="right" className="flex flex-col gap-4 overflow-y-auto sm:max-w-lg">
                <SheetHeader>
                    <SheetTitle>{isEdit ? `Edit Flow — ${flow.name}` : 'New Approval Flow'}</SheetTitle>
                    <SheetDescription>
                        {isEdit
                            ? 'Changing steps here only affects future requests; in-flight approval trails keep their original snapshot.'
                            : 'Build the office chain that papers travel through for this flow.'}
                    </SheetDescription>
                </SheetHeader>

                <FlowForm
                    data={data}
                    setData={setData}
                    errors={errors}
                    processing={processing}
                    submitLabel={isEdit ? 'Save Changes' : 'Create Flow'}
                    onSubmit={submit}
                    offices={offices}
                    flow={flow}
                    cancel={
                        <SheetClose asChild>
                            <Button type="button" variant="outline">
                                Cancel
                            </Button>
                        </SheetClose>
                    }
                />
            </SheetContent>
        </Sheet>
    );
}
