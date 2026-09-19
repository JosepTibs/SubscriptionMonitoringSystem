import { Head, useForm } from '@inertiajs/react';
import { LoaderCircle } from 'lucide-react';
import { FormEventHandler } from 'react';

import InputError from '@/components/input-error';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AuthLayout from '@/layouts/auth-layout';

interface RegisterForm {
    [key: string]: string;
    username: string;
    fname: string;
    mname: string;
    lname: string;
    sname: string;
    email: string;
    password: string;
    password_confirmation: string;
}

export default function Register() {
    const { data, setData, post, processing, errors, reset } = useForm<RegisterForm>({
        username: '',
        fname: '',
        mname: '',
        lname: '',
        sname: '',
        email: '',
        password: '',
        password_confirmation: '',
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('register'), {
            onFinish: () => reset('password', 'password_confirmation'),
        });
    };

    const inputClasses =
        'border-auth-surface bg-auth-surface text-auth-foreground placeholder:text-auth-muted focus:border-auth-accent focus:ring-auth-accent focus:ring-offset-0';

    return (
        <AuthLayout title="Create an account" description="Enter your details below to create your account">
            <Head title="Register" />
            <form className="mt-2 flex flex-col gap-4" onSubmit={submit}>
                <div className="grid gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="username" className="text-auth-foreground">
                            Username
                        </Label>
                        <Input
                            id="username"
                            type="text"
                            required
                            autoFocus
                            tabIndex={1}
                            autoComplete="username"
                            value={data.username}
                            onChange={(e) => setData('username', e.target.value)}
                            disabled={processing}
                            placeholder="Username"
                            className={inputClasses}
                        />
                        <InputError message={errors.username} className="mt-2" />
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                        <div className='flex flex-col gap-1.5'>
                        <Label htmlFor="fname" className="text-auth-foreground">
                           First Name
                        </Label>
                        <Input
                            id="fname"
                            type="text"
                            required
                            tabIndex={2}
                            autoComplete="fname"
                            value={data.fname}
                            onChange={(e) => setData('fname', e.target.value)}
                            disabled={processing}
                            placeholder="John"
                            className={inputClasses}
                        />
                        <InputError message={errors.fname} />
                        </div>
                        
                        <div className='flex flex-col gap-1.5'>
                        <Label htmlFor="mname" className="text-auth-foreground">
                           Middle Name
                        </Label>
                        <Input
                            id="mname"
                            type="text"
                            
                            tabIndex={2}
                            autoComplete="mname"
                            value={data.mname}
                            onChange={(e) => setData('mname', e.target.value)}
                            disabled={processing}
                            placeholder="Dela"
                            className={inputClasses}
                        />
                        <InputError message={errors.mname} />
                        </div>

                        <div className='flex flex-col gap-1.5'>
                        <Label htmlFor="lname" className="text-auth-foreground">
                           Last Name
                        </Label>
                        <Input
                            id="lname"
                            type="text"
                            required
                            tabIndex={2}
                            autoComplete="name"
                            value={data.lname}
                            onChange={(e) => setData('lname', e.target.value)}
                            disabled={processing}
                            placeholder="Cruz"
                            className={inputClasses}
                        />
                        <InputError message={errors.lname} />
                        </div>

                        <div className='flex flex-col gap-1.5'>
                        <Label htmlFor="sname" className="text-auth-foreground">
                           Suffix Name
                        </Label>
                        <Input
                            id="sname"
                            type="text"
                            
                            tabIndex={2}
                            autoComplete="sname"
                            value={data.sname}
                            onChange={(e) => setData('sname', e.target.value)}
                            disabled={processing}
                            placeholder="Jr."
                            className={inputClasses}
                        />
                        <InputError message={errors.sname} />
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="email" className="text-auth-foreground">
                            Email address
                        </Label>
                        <Input
                            id="email"
                            type="email"
                            required
                            tabIndex={3}
                            autoComplete="email"
                            value={data.email}
                            onChange={(e) => setData('email', e.target.value)}
                            disabled={processing}
                            placeholder="email@example.com"
                            className={inputClasses}
                        />
                        <InputError message={errors.email} />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="password" className="text-auth-foreground">
                            Password
                        </Label>
                        <Input
                            id="password"
                            type="password"
                            required
                            tabIndex={4}
                            autoComplete="new-password"
                            value={data.password}
                            onChange={(e) => setData('password', e.target.value)}
                            disabled={processing}
                            placeholder="Password"
                            className={inputClasses}
                        />
                        <InputError message={errors.password} />
                    </div>
                    
                    <div className="grid gap-2">
                        <Label htmlFor="password_confirmation" className="text-auth-foreground">
                            Confirm password
                        </Label>
                        <Input
                            id="password_confirmation"
                            type="password"
                            required
                            tabIndex={5}
                            autoComplete="new-password"
                            value={data.password_confirmation}
                            onChange={(e) => setData('password_confirmation', e.target.value)}
                            disabled={processing}
                            placeholder="Confirm password"
                            className={inputClasses}
                        />
                        <InputError message={errors.password_confirmation} />
                    </div>
                    </div>

                    <Button type="submit" className="mt-1 w-full" tabIndex={6} disabled={processing}>
                        {processing && <LoaderCircle className="h-4 w-4 animate-spin" />}
                        Create account
                    </Button>
                </div>

                <div className="text-center text-sm text-auth-muted">
                    Already have an account?{' '}
                    <TextLink href={route('login')} tabIndex={7} className="text-auth-accent">
                        Log in
                    </TextLink>
                </div>
            </form>
        </AuthLayout>
    );
}