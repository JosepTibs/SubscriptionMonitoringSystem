import BackButton from '@/components/navigation/back-button';
import { Button } from '@/components/ui/button';
import { Head } from '@inertiajs/react';
import { FileQuestion, House, ShieldX } from 'lucide-react';

interface ErrorPageProps extends Record<string, unknown> {
    status: number;
}

const errorConfig: Record<number, { title: string; description: string }> = {
    403: {
        title: 'Access denied',
        description:
            "You don't have permission to view this page. If you think this is a mistake, ask an administrator or your project manager for access.",
    },
    404: {
        title: 'Page not found',
        description: "The page you're looking for doesn't exist or may have been moved, archived, or deleted.",
    },
};

export default function ErrorPage({ status }: ErrorPageProps) {
    const config = errorConfig[status] ?? {
        title: 'Something went wrong',
        description: 'An unexpected error occurred. Please try again.',
    };
    const Icon = status === 403 ? ShieldX : FileQuestion;

    return (
        <>
            <Head title={`${status} · ${config.title}`} />

            <div className="bg-background flex min-h-screen flex-col items-center justify-center p-6 text-center">
                {/* Giant faded status code backdrop */}
                <div className="pointer-events-none fixed inset-0 flex items-center justify-center overflow-hidden">
                    <span className="text-muted-foreground/[0.04] font-mono text-[38vw] leading-none font-black select-none sm:text-[26vw]">
                        {status}
                    </span>
                </div>

                <div className="relative z-10 flex max-w-md flex-col items-center gap-5">
                    <div className="border-border bg-card flex h-16 w-16 items-center justify-center rounded-2xl border shadow-sm">
                        <Icon className="text-muted-foreground h-8 w-8" />
                    </div>

                    <div className="space-y-1.5">
                        <p className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">Error {status}</p>
                        <h1 className="text-2xl font-bold tracking-tight">{config.title}</h1>
                        <p className="text-muted-foreground text-sm">{config.description}</p>
                    </div>

                    <div className="mt-2 flex items-center gap-2">
                        <BackButton defaultUrl="/dashboard" label="Go back" />
                        <Button asChild size="sm">
                            <a href="/dashboard">
                                <House className="mr-2 h-4 w-4" />
                                Dashboard
                            </a>
                        </Button>
                    </div>
                </div>

                <p className="text-muted-foreground/60 absolute bottom-6 text-[11px]">Error code: {status}</p>
            </div>
        </>
    );
}
