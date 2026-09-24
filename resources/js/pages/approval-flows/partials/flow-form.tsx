import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { type ApprovalFlow, type Office } from '@/types';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { type FormEventHandler } from 'react';

export interface FlowFormData {
    name: string;
    description: string;
    steps: string[];
}

interface FlowFormProps {
    data: FlowFormData;
    setData: (key: keyof FlowFormData, value: string | string[]) => void;
    errors: Record<string, string>;
    processing: boolean;
    submitLabel: string;
    onSubmit: FormEventHandler;
    offices: Office[];
    flow?: ApprovalFlow;
}

export default function FlowForm({ data, setData, errors, processing, submitLabel, onSubmit, offices, flow }: FlowFormProps) {
    const availableOffices = offices.filter((office) => !data.steps.includes(String(office.id)));

    const addStep = (officeId: string) => {
        if (!officeId || officeId === 'none') {
            return;
        }

        setData('steps', [...data.steps, officeId]);
    };

    const removeStep = (index: number) => {
        setData(
            'steps',
            data.steps.filter((_, i) => i !== index),
        );
    };

    const moveStep = (index: number, direction: 'up' | 'down') => {
        const target = direction === 'up' ? index - 1 : index + 1;
        if (target < 0 || target >= data.steps.length) {
            return;
        }

        const steps = [...data.steps];
        [steps[index], steps[target]] = [steps[target], steps[index]];
        setData('steps', steps);
    };

    const officeName = (officeId: string) => offices.find((office) => String(office.id) === officeId)?.name ?? `Office #${officeId}`;


    return (
        <Card>
            <CardContent>
                <form onSubmit={onSubmit} className="grid gap-6">
                    <div className="grid gap-2">
                        <Label htmlFor="name">Flow name</Label>
                        <Input
                            id="name"
                            value={data.name}
                            onChange={(e) => setData('name', e.target.value)}
                            placeholder="e.g. Standard IT procurement"
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
                            placeholder="Optional description of when this flow is used"
                        />
                        <InputError message={errors.description} />
                    </div>

                    <div className="grid gap-2">
                        <Label>Office chain</Label>
                        <div className="text-muted-foreground text-sm">
                            The papers travel through these offices in order. Pre-filled ordering follows the office chain; reorder freely.
                        </div>

                        <Select value="none" onValueChange={addStep}>
                            <SelectTrigger className="w-full md:w-80">
                                <SelectValue placeholder="Add office" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none" disabled>
                                    Add office…
                                </SelectItem>
                                {availableOffices.map((office) => (
                                    <SelectItem key={office.id} value={String(office.id)}>
                                        {office.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <InputError message={errors.steps} />

                        {data.steps.length === 0 ? (
                            <div className="text-muted-foreground rounded-lg border border-dashed p-4 text-center text-sm">
                                No offices in the chain yet. Add at least one office.
                            </div>
                        ) : (
                            <ol className="grid gap-1">
                                {data.steps.map((officeId, index) => (
                                    <li key={`${officeId}-${index}`} className="flex items-center gap-2 rounded-lg border px-3 py-2">
                                        <span className="text-muted-foreground w-6 text-center text-sm">{index + 1}.</span>
                                        <span className="flex-1 text-sm font-medium">{officeName(officeId)}</span>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            disabled={index === 0}
                                            onClick={() => moveStep(index, 'up')}
                                            title="Move up"
                                        >
                                            <ArrowUp className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            disabled={index === data.steps.length - 1}
                                            onClick={() => moveStep(index, 'down')}
                                            title="Move down"
                                        >
                                            <ArrowDown className="h-4 w-4" />
                                        </Button>
                                        <Button type="button" variant="ghost" size="sm" onClick={() => removeStep(index)} title="Remove office">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </div>

                    {flow?.is_default && <div className="text-muted-foreground text-sm">This is the current default flow.</div>}

                    <div className="flex items-center gap-4">
                        <Button disabled={processing}>{submitLabel}</Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
