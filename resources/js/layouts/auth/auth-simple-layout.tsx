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
                                <div className="bg-auth-surface ring-auth-accent/30 mb-1 flex h-12 w-12 items-center justify-center rounded-md ring-1">
                                    <img src="/phccilogo.png" alt="PHCCI logo" className="size-10 object-contain" />
                                </div>
                                <span className="sr-only">{title}</span>
                            </Link>

                            <span className="text-auth-foreground text-center text-lg font-semibold tracking-wide">
                                PHCCI Subscription Monitoring System
                            </span>
                        </div>

                        <div className="space-y-2 text-center">
                            <h1 className="text-auth-foreground text-2xl font-semibold">{title}</h1>
                            <p className="text-auth-muted text-center text-sm">{description}</p>
                        </div>
                        {children}
                    </div>
                </div>
            </div>

            {/* Right Side - Dashboard Preview */}
            <div className="bg-auth-surface hidden p-8 md:flex md:w-1/2 md:items-center md:justify-center">
                <div className="w-full max-w-2xl space-y-4">
                    {/* Mock Dashboard UI */}
                    <div className="bg-auth-bg border-auth-accent/10 rounded-lg border p-6 shadow-2xl">
                        {/* Header / Top Nav Mock */}
                        <div className="border-auth-surface mb-6 flex items-center justify-between border-b pb-4">
                            <div className="flex items-center gap-3">
                                <div className="bg-auth-accent/20 flex h-6 w-6 items-center justify-center rounded-md">
                                    <div className="bg-auth-accent h-3 w-3 animate-pulse rounded-full" />
                                </div>
                                <div className="bg-auth-muted/40 h-4 w-36 rounded"></div>
                            </div>
                            <div className="flex gap-2">
                                <div className="bg-auth-surface border-auth-accent/20 h-8 w-20 rounded-lg border"></div>
                                <div className="bg-auth-surface h-8 w-8 rounded-full"></div>
                            </div>
                        </div>

                        {/* Content Layout */}
                        <div className="grid grid-cols-4 gap-4">
                            {/* Sidebar Navigation Mock */}
                            <div className="border-auth-surface col-span-1 space-y-2 border-r pr-2">
                                <div className="bg-auth-accent/10 border-auth-accent h-8 rounded-md border-l-2"></div>
                                <div className="bg-auth-surface/50 h-8 rounded-md"></div>
                                <div className="bg-auth-surface/50 h-8 rounded-md"></div>
                                <div className="bg-auth-surface/50 h-8 rounded-md"></div>
                            </div>

                            {/* Main Dashboard Content */}
                            <div className="col-span-3 space-y-4">
                                {/* Subscription Specific Metrics */}
                                <div className="grid grid-cols-3 gap-3">
                                    {/* Card 1: Total Active Contracts */}
                                    <div className="border-auth-surface bg-auth-surface/30 rounded-xl border p-3">
                                        <div className="bg-auth-muted/50 mb-2 h-3 w-16 rounded"></div>
                                        <div className="bg-auth-foreground/70 h-5 w-10 rounded"></div>
                                    </div>
                                    {/* Card 2: Total Monthly Cost */}
                                    <div className="border-auth-surface bg-auth-surface/30 rounded-xl border p-3">
                                        <div className="bg-auth-muted/50 mb-2 h-3 w-20 rounded"></div>
                                        <div className="bg-auth-accent h-5 w-16 rounded"></div>
                                    </div>
                                    {/* Card 3: Saved this Month */}
                                    <div className="border-auth-surface bg-auth-surface/30 rounded-xl border p-3">
                                        <div className="bg-auth-muted/50 mb-2 h-3 w-14 rounded"></div>
                                        <div className="h-5 w-12 rounded bg-emerald-500/80"></div>
                                    </div>
                                </div>

                                {/* Spend Analytics Chart */}
                                <div className="border-auth-surface bg-auth-surface/20 rounded-xl border p-4">
                                    <div className="mb-4 flex items-center justify-between">
                                        <div className="bg-auth-muted/60 h-3 w-28 rounded"></div>
                                        <div className="bg-auth-muted/30 h-2 w-12 rounded"></div>
                                    </div>
                                    <div className="flex h-24 items-end justify-between gap-3 px-2 pt-4">
                                        <div className="bg-auth-accent/40 h-10 w-full rounded-t"></div>
                                        <div className="bg-auth-accent/50 h-14 w-full rounded-t"></div>
                                        <div className="bg-auth-accent/30 h-8 w-full rounded-t"></div>
                                        <div className="bg-auth-accent h-20 w-full rounded-t"></div>
                                        <div className="bg-auth-accent/70 h-16 w-full rounded-t"></div>
                                    </div>
                                </div>

                                {/* Subscription Schedule Table Layout */}
                                <div className="border-auth-surface bg-auth-surface/20 space-y-3 rounded-xl border p-4">
                                    <div className="bg-auth-muted/60 mb-1 h-3 w-32 rounded"></div>

                                    {/* Row 1 */}
                                    <div className="border-auth-surface/50 flex items-center justify-between border-b pb-2">
                                        <div className="flex items-center gap-2">
                                            <div className="bg-auth-accent/20 h-5 w-5 rounded"></div>
                                            <div className="bg-auth-muted/80 h-3 w-20 rounded"></div>
                                        </div>
                                        <div className="bg-auth-accent/70 h-3 w-12 rounded"></div>
                                    </div>
                                    {/* Row 2 */}
                                    <div className="border-auth-surface/50 flex items-center justify-between border-b pb-2">
                                        <div className="flex items-center gap-2">
                                            <div className="bg-auth-accent/20 h-5 w-5 rounded"></div>
                                            <div className="bg-auth-muted/80 h-3 w-24 rounded"></div>
                                        </div>
                                        <div className="bg-auth-accent/70 h-3 w-12 rounded"></div>
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
