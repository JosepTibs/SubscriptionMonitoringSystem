import { Link } from '@inertiajs/react';

interface AuthImageLayoutProps {
    children: React.ReactNode;
    title?: string;
    description?: string;
    imageSrc?: string;
    overlayClassName?: string;
}

const DEFAULT_OVERLAY = 'bg-linear-to-br from-auth-bg/90 via-auth-bg/70 to-auth-bg/85';

export default function AuthImageLayout({
    children,
    title,
    description,
    imageSrc = '/phccibg.jpg',
    overlayClassName = DEFAULT_OVERLAY,
}: AuthImageLayoutProps) {
    return (
        <div className="bg-auth-bg relative flex min-h-svh w-full items-center justify-center overflow-hidden">
            {/* Full-screen background image */}
            <img
                src={imageSrc}
                alt="PHCCI"
                className="absolute inset-0 size-full object-cover"
            />

            {/* Dark overlay */}
            <div
                className={`absolute inset-0 ${overlayClassName}`}
                aria-hidden="true"
            />

            {/* Centered login content */}
            <div className="relative z-10 flex w-full max-w-md flex-col items-center p-6">
                <div className="w-full">
                    <div className="flex flex-col gap-8">
                        {/* Logo */}
                        <div className="flex flex-col items-center gap-3">
                            <Link
                                href={route('home')}
                                className="flex flex-col items-center gap-2 font-medium"
                            >
                                <div className="flex h-14 w-14 items-center justify-center">
                                    <img
                                        src="/phccilogo-light.png"
                                        alt="PHCCI logo"
                                        className="hidden size-11 object-contain dark:block"
                                    />
                                    <img
                                        src="/phccilogo-dark.png"
                                        alt="PHCCI logo"
                                        className="size-11 object-contain dark:hidden"
                                    />
                                </div>
                            </Link>

                            <span className="text-auth-foreground text-lg font-semibold tracking-wide">
                                PHCCI Subscription Monitoring System
                            </span>
                        </div>

                        {/* Login Card */}
                        <div className="rounded-xl bg-card/95 p-6 shadow-2xl backdrop-blur-sm">
                            <div className="space-y-2 text-center">
                                <h1 className="text-card-foreground text-2xl font-semibold">
                                    {title}
                                </h1>

                                <p className="text-sm text-muted-foreground">
                                    {description}
                                </p>
                            </div>

                            <div className="mt-6">
                                {children}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}