import { Head, router } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import CreateUserSheet from '@/components/users/create-user-sheet';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';

interface Role {
    id: number;
    name: string;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Users', href: '/users' },
    { title: 'Create', href: '/users/create' },
];

export default function CreateUserPage({ roles }: { roles: Role[] }) {
    const [open, setOpen] = useState(true);

    const handleOpenChange = (v: boolean) => {
        setOpen(v);
        if (!v) {
            router.visit('/users');
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Create User" />
            <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => router.visit('/users')}>
                        <ArrowLeft className="mr-1 h-4 w-4" /> Back
                    </Button>
                </div>
                <Card>
                    <CardHeader>
                        <CardTitle>Create user</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground text-sm">Use the form panel to add a new user account.</p>
                        <Button id="add-user-button" className="mt-4" onClick={() => setOpen(true)}>
                            Open form
                        </Button>
                    </CardContent>
                </Card>
                <CreateUserSheet open={open} onOpenChange={handleOpenChange} roles={roles} />
            </div>
        </AppLayout>
    );
}

