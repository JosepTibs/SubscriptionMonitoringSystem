import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { type Office } from '@/types';
import { Link, router } from '@inertiajs/react';
import { Eye, Pencil, Power } from 'lucide-react';
import { type OfficeRow } from './office-form-sheet';

interface OfficesTableProps {
    offices: OfficeRow[];
    onCreate: () => void;
    onEdit: (office: OfficeRow) => void;
}

export default function OfficesTable({ offices, onCreate, onEdit }: OfficesTableProps) {
    const activeOffices = offices.filter((office) => office.is_active);

    const toggleActive = (office: Office) => {
        if (!office.is_active) {
            router.patch(route('offices.toggle-active', office.id));
            return;
        }

        if (window.confirm(`Deactivate "${office.name}"? It will be skipped in future renewal forwards; existing history is preserved.`)) {
            router.patch(route('offices.toggle-active', office.id));
        }
    };

    return (
        <Card>
            <CardContent>
                <div className="flex flex-wrap items-center justify-between gap-4 pt-4">
                    <div>
                        <h2 className="text-base font-semibold">Offices</h2>
                        <p className="text-muted-foreground text-sm">Waypoint offices papers travel through, listed in chain order.</p>
                    </div>
                    <Button size="sm" onClick={onCreate}>
                        New Office
                    </Button>
                </div>

                <Table className="mt-4">
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="text-center">Subscriptions</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {offices.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-muted-foreground py-6 text-center">
                                    No offices yet. Create the first office to start the approval chain.
                                </TableCell>
                            </TableRow>
                        ) : (
                            offices.map((office) => {
                                const activeIndex = activeOffices.findIndex((active) => active.id === office.id);

                                return (
                                    <TableRow key={office.id} className={office.is_active ? '' : 'opacity-60'}>
                                        <Link href={route('offices.show', office.id)} title="View office history">
                                            <TableCell className="font-medium transition-all hover:font-bold hover:underline">
                                                {office.name}
                                            </TableCell>
                                        </Link>
                                        <TableCell className="text-muted-foreground max-w-xs truncate text-sm">{office.description ?? '—'}</TableCell>
                                        <TableCell className="text-center">{office.subscriptions_count ?? 0}</TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant={office.is_active ? 'default' : 'secondary'}>
                                                {office.is_active ? 'Active' : 'Inactive'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="flex justify-end gap-1">
                                            <Link href={route('offices.show', office.id)} title="View office history">
                                                <Button variant="ghost" size="sm">
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                            </Link>
                                            <Button variant="ghost" size="sm" onClick={() => onEdit(office)} title="Edit office">
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => toggleActive(office)}
                                                title={office.is_active ? 'Deactivate office' : 'Activate office'}
                                            >
                                                <Power className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
