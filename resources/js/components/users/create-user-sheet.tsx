import { router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { type FormEvent, useState } from 'react';

interface Role { id: number; name: string }

export interface SheetUserData {
    id: number;
    username: string;
    fname: string;
    mname: string;
    lname: string;
    sname: string;
    email: string;
    role_id: number | null;
}

interface CreateUserSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    roles: Role[];
    /** When provided, the sheet edits this user instead of creating a new one. */
    user?: SheetUserData | null;
}

export default function CreateUserSheet({ open, onOpenChange, roles, user }: CreateUserSheetProps) {
    const editing = Boolean(user);
    const [username, setUserName] = useState(user?.username ?? '');
    const [fname, setFirstName] = useState(user?.fname ?? '');
    const [mname, setMiddleName] = useState(user?.mname ?? '');
    const [lname, setLastName] = useState(user?.lname ?? '');
    const [sname, setSuffixName] = useState(user?.sname ?? '');
    const [email, setEmail] = useState(user?.email ?? '');
    const [password, setPassword] = useState('');
    const [passwordConfirmation, setPasswordConfirmation] = useState('');
    const [roleId, setRoleId] = useState(user?.role_id ? String(user.role_id) : '');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [processing, setProcessing] = useState(false);

    function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setProcessing(true);

        const payload = {
            username, fname, mname, lname, sname, email,
            password: password || undefined,
            password_confirmation: passwordConfirmation || undefined,
            role_id: roleId,
        };

        const options = {
            onError: (errs: Record<string, string>) => { setErrors(errs); setProcessing(false); },
            onSuccess: () => {
                setProcessing(false);
                setErrors({});
                onOpenChange(false);   // stay on the page; the redirect refreshes props
            },
        };

        if (editing && user) {
            router.put(`/users/${user.id}`, payload, options);
        } else {
            router.post('/users', payload, options);
        }
    }

    // on close (X / escape), clear stale errors + reset the form
    const handleOpenChange = (v: boolean) => { if (!v) { setErrors({}); } onOpenChange(v); };

    return (
        <Sheet open={open} onOpenChange={handleOpenChange}>
            <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
                <SheetHeader>
                    <SheetTitle>{editing ? 'Edit User' : 'Create User'}</SheetTitle>
                    <SheetDescription>
                        {editing ? 'Update the user details below.' : 'Fill in the user details below.'}
                    </SheetDescription>
                </SheetHeader>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Username */}
                    <div className="space-y-2">
                        <Label htmlFor="username">Username</Label>
                        <Input
                            id="username"
                            value={username}
                            onChange={(e) => setUserName(e.target.value)}
                            placeholder="Alwayswannafly"
                        />
                        {errors.username && (
                            <p className="text-sm text-red-600">{errors.username}</p>
                        )}
                    </div>

                    {/* Name */}
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="fname">First Name</Label>
                            <Input
                                id="fname"
                                value={fname}
                                onChange={(e) => setFirstName(e.target.value)}
                                placeholder="Joseph Daniel"
                            />
                            {errors.fname && (
                                <p className="text-sm text-red-600">{errors.fname}</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="mname">Middle Name</Label>
                            <Input
                                id="mname"
                                value={mname}
                                onChange={(e) => setMiddleName(e.target.value)}
                                placeholder="Divine"
                            />
                            {errors.mname && (
                                <p className="text-sm text-red-600">{errors.mname}</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="lname">Last Name</Label>
                            <Input
                                id="lname"
                                value={lname}
                                onChange={(e) => setLastName(e.target.value)}
                                placeholder="Teves"
                            />
                            {errors.lname && (
                                <p className="text-sm text-red-600">{errors.lname}</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="sname">Suffix</Label>
                            <Input
                                id="sname"
                                value={sname}
                                onChange={(e) => setSuffixName(e.target.value)}
                                placeholder="Jr"
                            />
                            {errors.sname && (
                                <p className="text-sm text-red-600">{errors.sname}</p>
                            )}
                        </div>
                    </div>

                    {/* Email */}
                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="john@example.com"
                        />
                        {errors.email && (
                            <p className="text-sm text-red-600">{errors.email}</p>
                        )}
                    </div>

                    {/* Password */}
                    <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <Input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Min. 8 characters"
                        />
                        {errors.password && (
                            <p className="text-sm text-red-600">{errors.password}</p>
                        )}
                    </div>

                    {/* Confirm Password */}
                    <div className="space-y-2">
                        <Label htmlFor="password_confirmation">Confirm Password</Label>
                        <Input
                            id="password_confirmation"
                            type="password"
                            value={passwordConfirmation}
                            onChange={(e) => setPasswordConfirmation(e.target.value)}
                            placeholder="Repeat password"
                        />
                    </div>

                    {/* Role */}
                    <div className="space-y-2">
                        <Label htmlFor="role">Role</Label>
                        <Select value={roleId} onValueChange={setRoleId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                            <SelectContent>
                                {roles.map((role) => (
                                    <SelectItem key={role.id} value={String(role.id)}>
                                        {role.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {errors.role_id && (
                            <p className="text-sm text-red-600">{errors.role_id}</p>
                        )}
                    </div>
                    <SheetFooter className="mt-6 flex gap-3">
                        <Button variant="outline" type="button" onClick={() => handleOpenChange(false)}>Cancel</Button>
                        <Button type="submit" disabled={processing}>
                            {processing
                                ? (editing ? 'Saving…' : 'Creating...')
                                : (editing ? 'Save Changes' : 'Create User')}
                        </Button>
                    </SheetFooter>
                </form>
            </SheetContent>
        </Sheet>
    );
}
