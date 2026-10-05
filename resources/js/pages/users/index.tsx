import { confirmRequest } from '@/components/confirm-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import CreateUserSheet from '@/components/users/create-user-sheet';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    columnFilteringFeature,
    columnVisibilityFeature,
    createColumnHelper,
    createFilteredRowModel,
    createPaginatedRowModel,
    createSortedRowModel,
    globalFilteringFeature,
    rowPaginationFeature,
    rowSortingFeature,
    tableFeatures,
    useTable,
    type FilterFn,
    type SortingState,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, Archive, ArchiveRestore, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Users',
        href: '/users',
    },
];

interface Role {
    id: number;
    name: string;
}

interface UserItem {
    id: number;
    username: string;
    fname: string;
    mname: string;
    lname: string;
    sname: string;
    email: string;
    email_verified_at: string | null;
    role: { id: number; name: string } | null;
    is_archived: boolean;
    created_at: string;
}

interface UsersPageProps extends Record<string, unknown> {
    users: UserItem[];
    roles: Role[];
    filters: {
        search: string | null;
        role: string | null;
        show: string | null;
    };
    auth?: {
        user?: {
            id: number;
            name: string;
            email: string;
        } | null;
        roles?: string[];
        can_manage_records?: boolean;
    };
}

function formatFullName(user: UserItem) {
    const parts = [user.fname, user.mname, user.lname, user.sname].filter(Boolean);
    return parts.join(' ');
}
function getRoleBadgeVariant(roleName: string) {
    switch (roleName?.toLowerCase()) {
        case 'superadmin':
        case 'admin':
            return 'destructive' as const;
        case 'project manager':
            return 'default' as const;
        default:
            return 'secondary' as const;
    }
}

const features = tableFeatures({
    globalFilteringFeature,
    columnFilteringFeature,
    columnVisibilityFeature,
    rowSortingFeature,
    rowPaginationFeature,
    filteredRowModel: createFilteredRowModel(),
    sortedRowModel: createSortedRowModel(),
    paginatedRowModel: createPaginatedRowModel(),
});
// Custom filter function that searches across name, email, and role name
const globalFilterFn: FilterFn<typeof features, UserItem> = (row, columnId, filterValue: string) => {
    const search = filterValue.toLowerCase();
    const user = row.original;
    const fullName = formatFullName(user);
    return (
        fullName.toLowerCase().includes(search) ||
        user.username.toLowerCase().includes(search) ||
        user.email.toLowerCase().includes(search) ||
        (user.role?.name ?? '').toLowerCase().includes(search)
    );
};

const columnHelper = createColumnHelper<typeof features, UserItem>();

export default function UsersIndex() {
    const { users, roles, filters, auth } = usePage<UsersPageProps>().props;
    const canManage = auth?.can_manage_records ?? auth?.roles?.includes('superadmin') ?? false;
    const archivedView = filters.show === 'archived';
    const [globalFilter, setGlobalFilter] = useState(filters.search ?? '');
    const [roleFilter, setRoleFilter] = useState(filters.role ?? '');
    const [sorting, setSorting] = useState<SortingState>([]);
    const [createOpen, setCreateOpen] = useState(false);

    // Apply role filter to data
    const filteredData = useMemo(() => {
        if (!roleFilter || roleFilter === 'all') return users;
        return users.filter((user) => user.role?.id === Number(roleFilter));
    }, [users, roleFilter]);

    const columns = useMemo(
        () =>
            columnHelper.columns([
                columnHelper.accessor('username', {
                    header: ({ column }) => {
                        const isSorted = column.getIsSorted();
                        return (
                            <button className="hover:text-foreground flex items-center gap-1 font-medium" onClick={() => column.toggleSorting()}>
                                Username
                                {isSorted === 'asc' ? (
                                    <ArrowUp className="h-3 w-3" />
                                ) : isSorted === 'desc' ? (
                                    <ArrowDown className="h-3 w-3" />
                                ) : (
                                    <ArrowUpDown className="h-3 w-3 opacity-50" />
                                )}
                            </button>
                        );
                    },
                    cell: ({ row, getValue }) => (
                        <Link href={`/users/${row.original.id}`} className="font-medium hover:underline">
                            {getValue()}
                        </Link>
                    ),
                }),

                columnHelper.display({
                    id: 'name',
                    header: ({ column }) => {
                        const isSorted = column.getIsSorted();
                        return (
                            <button className="hover:text-foreground flex items-center gap-1 font-medium" onClick={() => column.toggleSorting()}>
                                Name
                                {isSorted === 'asc' ? (
                                    <ArrowUp className="h-3 w-3" />
                                ) : isSorted === 'desc' ? (
                                    <ArrowDown className="h-3 w-3" />
                                ) : (
                                    <ArrowUpDown className="h-3 w-3 opacity-50" />
                                )}
                            </button>
                        );
                    },
                    cell: ({ row }) => {
                        const fullName = formatFullName(row.original);
                        return (
                            <Link href={`/users/${row.original.id}`} className="font-medium hover:underline">
                                {fullName}
                            </Link>
                        );
                    },
                }),

                columnHelper.accessor('email', {
                    header: ({ column }) => {
                        const isSorted = column.getIsSorted();
                        return (
                            <button className="hover:text-foreground flex items-center gap-1 font-medium" onClick={() => column.toggleSorting()}>
                                Email
                                {isSorted === 'asc' ? (
                                    <ArrowUp className="h-3 w-3" />
                                ) : isSorted === 'desc' ? (
                                    <ArrowDown className="h-3 w-3" />
                                ) : (
                                    <ArrowUpDown className="h-3 w-3 opacity-50" />
                                )}
                            </button>
                        );
                    },
                    cell: ({ getValue }) => <span className="text-muted-foreground">{getValue()}</span>,
                }),
                columnHelper.accessor('role', {
                    header: 'Role',
                    cell: ({ getValue }) => {
                        const role = getValue();
                        return role ? (
                            <Badge variant={getRoleBadgeVariant(role.name)}>{role.name}</Badge>
                        ) : (
                            <span className="text-muted-foreground">—</span>
                        );
                    },
                    enableSorting: false,
                }),
                columnHelper.accessor('email_verified_at', {
                    header: 'Status',
                    cell: ({ getValue }) => {
                        const verified = getValue();
                        return verified ? (
                            <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                                Verified
                            </Badge>
                        ) : (
                            <Badge variant="outline">Unverified</Badge>
                        );
                    },
                    enableSorting: false,
                }),
                columnHelper.accessor('created_at', {
                    header: ({ column }) => {
                        const isSorted = column.getIsSorted();
                        return (
                            <button className="hover:text-foreground flex items-center gap-1 font-medium" onClick={() => column.toggleSorting()}>
                                Joined
                                {isSorted === 'asc' ? (
                                    <ArrowUp className="h-3 w-3" />
                                ) : isSorted === 'desc' ? (
                                    <ArrowDown className="h-3 w-3" />
                                ) : (
                                    <ArrowUpDown className="h-3 w-3 opacity-50" />
                                )}
                            </button>
                        );
                    },
                    cell: ({ getValue }) => <span className="text-muted-foreground">{getValue()}</span>,
                }),
                columnHelper.display({
                    id: 'actions',
                    header: () => <span className="sr-only">Actions</span>,
                    cell: ({ row }) => {
                        const user = row.original;
                        return (
                            <div className="flex justify-end gap-2">
                                <Link href={`/users/${user.id}/edit`}>
                                    <Button variant="outline" size="sm">
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                </Link>
                                {canManage && archivedView && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleUnarchive(user.id, formatFullName(user))}
                                    >
                                        <ArchiveRestore className="h-4 w-4" />
                                    </Button>
                                )}
                                {canManage && !archivedView && (
                                    <Button variant="outline" size="sm" onClick={() => handleArchive(user.id, formatFullName(user))}>
                                        <Archive className="h-4 w-4" />
                                    </Button>
                                )}
                                {canManage && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-red-600 hover:text-red-700"
                                        onClick={() => handleDelete(user.id, formatFullName(user))}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        );
                    },
                }),
            ]),
        [canManage, archivedView],
    );

    const table = useTable({
        features,
        data: filteredData,
        columns,
        state: {
            globalFilter,
            sorting,
        },
        onGlobalFilterChange: setGlobalFilter,
        onSortingChange: setSorting,
        globalFilterFn,
        initialState: {
            pagination: {
                pageIndex: 0,
                pageSize: 10,
            },
        },
    });

    async function handleArchive(userId: number, userName: string) {
        const ok = await confirmRequest({
            title: `Archive "${userName}"?`,
            description: 'The account will be hidden from this list and can no longer sign in. History is kept.',
            confirmLabel: 'Archive user',
            destructive: false,
        });

        if (ok) {
            router.patch(`/users/${userId}/archive`, {}, { preserveScroll: true });
        }
    }

    async function handleUnarchive(userId: number, userName: string) {
        const ok = await confirmRequest({
            title: `Unarchive "${userName}"?`,
            description: 'The account will show in the active list and can sign in again.',
            confirmLabel: 'Unarchive user',
            destructive: false,
        });

        if (ok) {
            router.patch(`/users/${userId}/unarchive`, {}, { preserveScroll: true });
        }
    }

    async function handleDelete(userId: number, userName: string) {
        const ok = await confirmRequest({
            title: `Delete "${userName}"?`,
            description: 'This will permanently remove the user account and revoke their access. This action cannot be undone.',
            confirmLabel: 'Delete user',
        });

        if (ok) {
            router.delete(`/users/${userId}`, { preserveScroll: true });
        }
    }

    const handleRoleChange = useCallback((value: string) => {
        setRoleFilter(value);
    }, []);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Users" />
            <CreateUserSheet open={createOpen} onOpenChange={setCreateOpen} roles={roles} />
            <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold">Users</h1>

                    <Button id="add-user-button" onClick={() => setCreateOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add User
                    </Button>
                </div>

                {/* Filters */}
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex flex-col gap-4 sm:flex-row">
                            <div className="relative flex-1">
                                <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                                <Input
                                    id="meh"
                                    placeholder="Search by username, name, email, or role..."
                                    value={globalFilter}
                                    onChange={(e) => setGlobalFilter(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                            <div className="w-full sm:w-48">
                                <Select value={roleFilter} onValueChange={handleRoleChange}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="All roles" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All roles</SelectItem>
                                        {roles.map((role) => (
                                            <SelectItem key={role.id} value={String(role.id)}>
                                                {role.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="w-full sm:w-36">
                                <Select
                                    value={archivedView ? 'archived' : 'active'}
                                    onValueChange={(value) =>
                                        router.get(
                                            '/users',
                                            value === 'archived' ? { show: 'archived' } : {},
                                            { preserveState: true, preserveScroll: true, replace: true },
                                        )
                                    }
                                >
                                    <SelectTrigger aria-label="Archived filter">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="archived">Archived</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Users Table */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">
                            {archivedView ? 'Archived Users' : 'All Users'} ({filteredData.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {table.getRowModel().rows.length > 0 ? (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        {table.getHeaderGroups().map((headerGroup) => (
                                            <TableRow key={headerGroup.id}>
                                                {headerGroup.headers.map((header) => (
                                                    <TableHead key={header.id}>
                                                        {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                                                    </TableHead>
                                                ))}
                                            </TableRow>
                                        ))}
                                    </TableHeader>
                                    <TableBody>
                                        {table.getRowModel().rows.map((row) => (
                                            <TableRow key={row.id}>
                                                {row.getVisibleCells().map((cell) => (
                                                    <TableCell key={cell.id}>
                                                        <table.FlexRender cell={cell} />
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        ) : (
                            <p className="text-muted-foreground py-8 text-center text-sm">No users found.</p>
                        )}

                        {/* Pagination */}
                        {table.getPageCount() > 1 && (
                            <div className="mt-4 flex flex-col items-center justify-between gap-2 sm:flex-row">
                                <div className="flex items-center gap-2">
                                    <p className="text-muted-foreground text-sm">
                                        Showing{' '}
                                        <span className="font-medium">{table.state.pagination.pageIndex * table.state.pagination.pageSize + 1}</span>{' '}
                                        to{' '}
                                        <span className="font-medium">
                                            {Math.min(
                                                (table.state.pagination.pageIndex + 1) * table.state.pagination.pageSize,
                                                table.getFilteredRowModel().rows.length,
                                            )}
                                        </span>{' '}
                                        of <span className="font-medium">{table.getFilteredRowModel().rows.length}</span> users
                                    </p>
                                    <Select
                                        value={String(table.state.pagination.pageSize)}
                                        onValueChange={(value) => table.setPageSize(Number(value))}
                                    >
                                        <SelectTrigger className="w-20">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {[10, 25, 50].map((size) => (
                                                <SelectItem key={size} value={String(size)}>
                                                    {size}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Button variant="outline" size="sm" onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}>
                                        <ChevronsLeft className="h-4 w-4" />
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    {Array.from({ length: table.getPageCount() }, (_, i) => i + 1)
                                        .filter((page) => {
                                            const currentPage = table.state.pagination.pageIndex + 1;
                                            return page === 1 || page === table.getPageCount() || Math.abs(page - currentPage) <= 1;
                                        })
                                        .map((page, idx, arr) => (
                                            <span key={page} className="flex items-center">
                                                {idx > 0 && arr[idx - 1] !== page - 1 && <span className="text-muted-foreground px-1">...</span>}
                                                <Button
                                                    variant={page === table.state.pagination.pageIndex + 1 ? 'default' : 'outline'}
                                                    size="sm"
                                                    className="min-w-8"
                                                    onClick={() => table.setPageIndex(page - 1)}
                                                >
                                                    {page}
                                                </Button>
                                            </span>
                                        ))}
                                    <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                                        disabled={!table.getCanNextPage()}
                                    >
                                        <ChevronsRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
