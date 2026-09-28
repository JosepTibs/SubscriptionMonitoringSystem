import { Button } from '@/components/ui/button';
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { type Office } from '@/types';
import { useForm } from '@inertiajs/react';
import { type FormEventHandler } from 'react';
import OfficeForm, { type OfficeFormData } from './office-form';

export type OfficeRow = Office & { subscriptions_count?: number };

interface OfficeFormSheetProps {
    /** The office being edited; omit for create mode. */
    office?: OfficeRow;
    nextSortOrder: number;
    onClose: () => void;
}

export default function OfficeFormSheet({ office, nextSortOrder, onClose }: OfficeFormSheetProps) {
    const isEdit = office !== undefined;

    const { data, setData, post, patch, processing, errors } = useForm<OfficeFormData>({
        name: office?.name ?? '',
        description: office?.description ?? '',
        sort_order: isEdit ? undefined : String(nextSortOrder),
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();

        const options = { onSuccess: onClose };

        if (isEdit && office) {
            patch(route('offices.update', office.id), options);
            return;
        }

        post(route('offices.store'), options);
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
                    <SheetTitle>{isEdit ? `Edit Office — ${office.name}` : 'New Office'}</SheetTitle>
                    <SheetDescription>
                        {isEdit
                            ? 'Update the office details. Use the arrows on the list to reorder the approval chain.'
                            : 'Offices are added to the end of the approval chain unless you set a custom order.'}
                    </SheetDescription>
                </SheetHeader>

                <OfficeForm
                    data={data}
                    setData={setData}
                    errors={errors}
                    processing={processing}
                    submitLabel={isEdit ? 'Save Changes' : 'Create Office'}
                    onSubmit={submit}
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
