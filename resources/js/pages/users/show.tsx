import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import CreateUserSheet from '@/components/users/create-user-sheet';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';

interface Role {
    id: number;
    name: string;
}

interface ShowUser {
    id: number;
    username: string;
    fname: string;
    mname: string;
    lname: string;
    sname: string;
    email: string;
    role: { id: number; name: string } | null;
    role_id: number | null;
    created_at: string;
}

interface UserShowProps {
    user: ShowUser;
    roles: Role[];
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Users', href: '/users' },
];

function fullName(user: ShowUser): string {
    return [user.fname, user.mname, user.lname, user.sname].filter(Boolean).join(' ');
}

export default function UserShowPage({ user, roles }: UserShowProps) {
    const [editOpen, setEditOpen] = useState(false);

    return (
        <AppLayout breadcrumbs={[...breadcrumbs, { title: user.username, href: `/users/${user.id}` }]}>
            <Head title={user.username} />
            <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => router.visit('/users')}>
                        <ArrowLeft className="mr-1 h-4 w-4" /> Back to Users
                    </Button>
                </div>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>{fullName(user) || user.username}</CardTitle>
                        <Button id="edit-user-button" onClick={() => setEditOpen(true)}>
                            Edit details
                        </Button>
                    </CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-1">
                            <span className="text-muted-foreground text-xs">Username</span>
                            <span className="text-sm font-medium">{user.username}</span>
                        </div>
                        <div className="grid gap-1">
                            <span className="text-muted-foreground text-xs">Email</span>
                            <span className="text-sm font-medium">{user.email}</span>
                        </div>
                        <div className="grid gap-1">
                            <span className="text-muted-foreground text-xs">Role</span>
                            <span>{user.role ? <Badge variant="secondary">{user.role.name}</Badge> : '—'}</span>
                        </div>
                        <div className="grid gap-1">
                            <span className="text-muted-foreground text-xs">Joined</span>
                            <span className="text-sm font-medium">{user.created_at}</span>
                        </div>
                    </CardContent>
                </Card>

                <CreateUserSheet
                    key={user.id}
                    open={editOpen}
                    onOpenChange={setEditOpen}
                    roles={roles}
                    user={{
                        id: user.id,
                        username: user.username,
                        fname: user.fname,
                        mname: user.mname,
                        lname: user.lname,
                        sname: user.sname,
                        email: user.email,
                        role_id: user.role_id ?? user.role?.id ?? null,
                    }}
                />
            </div>
        </AppLayout>
    );
}
