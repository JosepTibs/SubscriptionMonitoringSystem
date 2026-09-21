import Heading from '@/components/heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, type Office } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { ArrowDown, ArrowUp, Pencil, Power } from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Offices', href: '/offices' },
];

interface OfficesIndexProps extends Record<string, unknown> {
    offices: (Office & { subscriptions_count?: number })[];
}

export default function OfficesIndex({ offices }: OfficesIndexProps) {
    const activeOffices = offices.filter((office) => office.is_active);

    const move = (office: Office, direction: 'up' | 'down') => {
        router.patch(route('offices.move', office.id), { direction });
    };

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
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Offices" />

            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <Heading
                        title="Offices"
                        description="Manage offices and the approval chain order used by renewal forwarding."
                    />
                    <Link href={route('offices.create')}>
                        <Button>New Office</Button>
                    </Link>
                </div>

                <Card>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12">#</TableHead>
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
                                                <TableCell className="font-medium">
                                                    {office.is_active ? activeIndex + 1 : '—'}
                                                </TableCell>
                                                <TableCell className="font-medium">{office.name}</TableCell>
                                                <TableCell className="text-muted-foreground max-w-xs truncate text-sm">
                                                    {office.description ?? '—'}
                                                </TableCell>
                                                <TableCell className="text-center">{office.subscriptions_count ?? 0}</TableCell>
                                                <TableCell className="text-center">
                                                    <Badge variant={office.is_active ? 'default' : 'secondary'}>
                                                        {office.is_active ? 'Active' : 'Inactive'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="flex justify-end gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        disabled={!office.is_active || activeIndex <= 0}
                                                        onClick={() => move(office, 'up')}
                                                        title="Move up in chain"
                                                    >
                                                        <ArrowUp className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        disabled={
                                                            !office.is_active ||
                                                            activeIndex === -1 ||
                                                            activeIndex >= activeOffices.length - 1
                                                        }
                                                        onClick={() => move(office, 'down')}
                                                        title="Move down in chain"
                                                    >
                                                        <ArrowDown className="h-4 w-4" />
                                                    </Button>
                                                    <Link href={route('offices.edit', office.id)}>
                                                        <Button variant="ghost" size="sm" title="Edit office">
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                    </Link>
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
            </div>
        </AppLayout>
    );
}
