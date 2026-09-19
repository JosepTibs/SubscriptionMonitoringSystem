import { Link } from '@inertiajs/react';

interface AuthLayoutProps {
    children: React.ReactNode;
    name?: string;
    title?: string;
    description?: string;
}

export default function AuthSimpleLayout({ children, title, description }: AuthLayoutProps) {
    return (
        <div className="bg-auth-bg flex min-h-svh w-full">
            {/* Left Side - Login Form */}
            <div className="flex w-full flex-col items-center justify-center gap-6 p-6 md:w-1/2 md:p-10">
                <div className="w-full max-w-sm">
                    <div className="flex flex-col gap-8">
                        <div className="flex flex-col items-center gap-3">
                            <Link href={route('home')} className="flex flex-col items-center gap-2 font-medium">
                                <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-md bg-auth-surface ring-1 ring-auth-accent/30">
                                    <img src="/phccilogo.png" alt="PHCCI logo" className="size-10 object-contain" />
                                </div>
                                <span className="sr-only">{title}</span>
                            </Link>

                            <span className="text-center text-lg font-semibold tracking-wide text-auth-foreground">
                                PHCCI  Subscription Monitoring System
                            </span>
                        </div>

                        <div className="space-y-2 text-center">
                            <h1 className="text-2xl font-semibold text-auth-foreground">{title}</h1>
                            <p className="text-auth-muted text-center text-sm">{description}</p>
                        </div>
                        {children}
                    </div>
                </div>
            </div>

            {/* Right Side - Dashboard Preview */}
<div className="hidden md:flex md:w-1/2 md:items-center md:justify-center bg-auth-surface p-8">
    <div className="w-full max-w-2xl space-y-4">
        {/* Mock Dashboard UI */}
        <div className="rounded-lg bg-auth-bg p-6 shadow-2xl border border-auth-accent/10">
            {/* Header / Top Nav Mock */}
            <div className="mb-6 flex items-center justify-between border-b border-auth-surface pb-4">
                <div className="flex items-center gap-3">
                    <div className="h-6 w-6 rounded-md bg-auth-accent/20 flex items-center justify-center">
                        <div className="h-3 w-3 rounded-full bg-auth-accent animate-pulse" />
                    </div>
                    <div className="h-4 w-36 rounded bg-auth-muted/40"></div>
                </div>
                <div className="flex gap-2">
                    <div className="h-8 w-20 rounded-lg bg-auth-surface border border-auth-accent/20"></div>
                    <div className="h-8 w-8 rounded-full bg-auth-surface"></div>
                </div>
            </div>

            {/* Content Layout */}
            <div className="grid grid-cols-4 gap-4">
                {/* Sidebar Navigation Mock */}
                <div className="col-span-1 space-y-2 border-r border-auth-surface pr-2">
                    <div className="h-8 rounded-md bg-auth-accent/10 border-l-2 border-auth-accent"></div>
                    <div className="h-8 rounded-md bg-auth-surface/50"></div>
                    <div className="h-8 rounded-md bg-auth-surface/50"></div>
                    <div className="h-8 rounded-md bg-auth-surface/50"></div>
                </div>

                {/* Main Dashboard Content */}
                <div className="col-span-3 space-y-4">
                    {/* Subscription Specific Metrics */}
                    <div className="grid grid-cols-3 gap-3">
                        {/* Card 1: Total Active Contracts */}
                        <div className="rounded-xl border border-auth-surface bg-auth-surface/30 p-3">
                            <div className="mb-2 h-3 w-16 rounded bg-auth-muted/50"></div>
                            <div className="h-5 w-10 rounded bg-auth-foreground/70"></div>
                        </div>
                        {/* Card 2: Total Monthly Cost */}
                        <div className="rounded-xl border border-auth-surface bg-auth-surface/30 p-3">
                            <div className="mb-2 h-3 w-20 rounded bg-auth-muted/50"></div>
                            <div className="h-5 w-16 rounded bg-auth-accent"></div>
                        </div>
                        {/* Card 3: Saved this Month */}
                        <div className="rounded-xl border border-auth-surface bg-auth-surface/30 p-3">
                            <div className="mb-2 h-3 w-14 rounded bg-auth-muted/50"></div>
                            <div className="h-5 w-12 rounded bg-emerald-500/80"></div>
                        </div>
                    </div>

                    {/* Spend Analytics Chart */}
                    <div className="rounded-xl border border-auth-surface bg-auth-surface/20 p-4">
                        <div className="mb-4 flex justify-between items-center">
                            <div className="h-3 w-28 rounded bg-auth-muted/60"></div>
                            <div className="h-2 w-12 rounded bg-auth-muted/30"></div>
                        </div>
                        <div className="flex items-end justify-between gap-3 h-24 pt-4 px-2">
                            <div className="h-10 w-full rounded-t bg-auth-accent/40"></div>
                            <div className="h-14 w-full rounded-t bg-auth-accent/50"></div>
                            <div className="h-8 w-full rounded-t bg-auth-accent/30"></div>
                            <div className="h-20 w-full rounded-t bg-auth-accent"></div>
                            <div className="h-16 w-full rounded-t bg-auth-accent/70"></div>
                        </div>
                    </div>

                    {/* Subscription Schedule Table Layout */}
                    <div className="rounded-xl border border-auth-surface bg-auth-surface/20 p-4 space-y-3">
                        <div className="h-3 w-32 rounded bg-auth-muted/60 mb-1"></div>
                        
                        {/* Row 1 */}
                        <div className="flex items-center justify-between border-b border-auth-surface/50 pb-2">
                            <div className="flex items-center gap-2">
                                <div className="h-5 w-5 rounded bg-auth-accent/20"></div>
                                <div className="h-3 w-20 rounded bg-auth-muted/80"></div>
                            </div>
                            <div className="h-3 w-12 rounded bg-auth-accent/70"></div>
                        </div>
                        {/* Row 2 */}
                        <div className="flex items-center justify-between border-b border-auth-surface/50 pb-2">
                            <div className="flex items-center gap-2">
                                <div className="h-5 w-5 rounded bg-auth-accent/20"></div>
                                <div className="h-3 w-24 rounded bg-auth-muted/80"></div>
                            </div>
                            <div className="h-3 w-12 rounded bg-auth-accent/70"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

            </div>
        
    );
}
