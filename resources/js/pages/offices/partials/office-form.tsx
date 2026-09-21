import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormEventHandler } from 'react';

export interface OfficeFormData {
    name: string;
    description: string;
    sort_order?: string;
}

interface OfficeFormProps {
    data: OfficeFormData;
    setData: (key: keyof OfficeFormData, value: string) => void;
    errors: Record<string, string>;
    processing: boolean;
    submitLabel: string;
    onSubmit: FormEventHandler;
    extra?: React.ReactNode;
}

export default function OfficeForm({ data, setData, errors, processing, submitLabel, onSubmit, extra }: OfficeFormProps) {
    return (
        <Card>
            <CardContent>
                <form onSubmit={onSubmit} className="grid gap-6">
                    <div className="grid gap-2">
                        <Label htmlFor="name">Office name</Label>
                        <Input
                            id="name"
                            value={data.name}
                            onChange={(e) => setData('name', e.target.value)}
                            placeholder="e.g. Accounting"
                            required
                        />
                        <InputError message={errors.name} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="description">Description</Label>
                        <textarea
                            id="description"
                            className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-lg border bg-transparent px-3 py-2 text-base transition-[color,box-shadow] outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                            value={data.description}
                            onChange={(e) => setData('description', e.target.value)}
                            placeholder="Optional description of this office's role in the chain"
                        />
                        <InputError message={errors.description} />
                    </div>

                    {extra}

                    <div className="flex items-center gap-4">
                        <Button disabled={processing}>{submitLabel}</Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
