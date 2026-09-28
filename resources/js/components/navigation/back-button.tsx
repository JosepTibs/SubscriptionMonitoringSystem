import { Button } from '@/components/ui/button';
import { goBack } from '@/components/navigation/use-go-back';
import { ArrowLeft } from 'lucide-react';

interface BackButtonProps {
    /** Deterministic destination used when no previous page can be inferred. */
    defaultUrl: string;
    /** A known/resolved back URL (e.g. a backend-provided backUrl). */
    preferred?: string | null;
    /** Visible text. Defaults to "Back". */
    label?: string;
    variant?: React.ComponentProps<typeof Button>['variant'];
    size?: React.ComponentProps<typeof Button>['size'];
    className?: string;
    ['aria-label']?: string;
}

/**
 * A reliable "Back" button for the Inertia SPA.
 *
 * Navigates to where the user actually came from (a project detail, list page,
 * etc.) using the shared `goBack` helper, with a deterministic fallback. This
 * replaces the fragile `window.history.back()` calls that got users "stuck" on
 * the same page after a refresh.
 */
export default function BackButton({
    defaultUrl,
    preferred,
    label = 'Back',
    variant = 'outline',
    size = 'sm',
    className,
    ...rest
}: BackButtonProps) {
    return (
        <Button
            type="button"
            variant={variant}
            size={size}
            className={className}
            onClick={() => goBack(defaultUrl, preferred)}
            {...rest}
        >
            <ArrowLeft className={label ? 'mr-2 h-4 w-4' : 'h-4 w-4'} />
            {label}
        </Button>
    );
}