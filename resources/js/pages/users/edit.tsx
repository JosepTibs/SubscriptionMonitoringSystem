import { Head, router } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import EditUserSheet from '@/components/users/edit-user-sheet';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';

interface Role {
    id: number;
    name: string;
}

interface EditableUser {
    id: number;
    username: string;
    fname: string;
    mname: string;
    lname: string;
    sname: string;
    email: string;
    role_id: number | null;
}

interface EditUserProps {
    user: EditableUser;
    roles: Role[];
    role_name: string | null;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Users', href: '/users' },
];

function fullName(user: EditableUser): string {
    return [user.fname, user.mname, user.lname, user.sname].filter(Boolean).join(' ');
}

export default function EditUserPage({ user, roles, role_name }: EditUserProps) {
    const [open, setOpen] = useState(false);

    return (
        <AppLayout breadcrumbs={[...breadcrumbs, { title: user.username, href: `/users/${user.id}/edit` }]}>
            <Head title={`Edit — ${user.username}`} />
            <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => router.visit('/users')}>
                        <ArrowLeft className="mr-1 h-4 w-4" /> Back
                    </Button>
                </div>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>Edit user — {user.username}</CardTitle>
                        <Button id="edit-user-button" onClick={() => setOpen(true)}>Edit details</Button>
                    </CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-1">
                            <span className="text-muted-foreground text-xs">Full name</span>
                            <span className="text-sm font-medium">{fullName(user) || '—'}</span>
                        </div>
                        <div className="grid gap-1">
                            <span className="text-muted-foreground text-xs">Email</span>
                            <span className="text-sm font-medium">{user.email}</span>
                        </div>
                        <div className="grid gap-1">
                            <span className="text-muted-foreground text-xs">Role</span>
                            <span>{role_name ? <Badge variant="secondary">{role_name}</Badge> : '—'}</span>
                        </div>
                    </CardContent>
                </Card>

                <EditUserSheet open={open} onOpenChange={setOpen} roles={roles} user={user} />
            </div>
        </AppLayout>
    );
}
