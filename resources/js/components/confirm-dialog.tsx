import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type ConfirmOptions = {
    /** Dialog heading, e.g. `Delete "Website launch"?` */
    title: string;
    /** Consequence statement shown under the title. */
    description?: string;
    /** Label of the action button. Defaults to "Delete". */
    confirmLabel?: string;
    /** Label of the cancel button. Defaults to "Cancel". */
    cancelLabel?: string;
    /** When true (default) the action button uses the destructive style. */
    destructive?: boolean;
};

type ConfirmState = ConfirmOptions & {
    resolve: (ok: boolean) => void;
};

const ConfirmContext = createContext<(options: ConfirmOptions) => Promise<boolean>>(
    () => Promise.resolve(false),
);

// Module-level delegate so code outside React components (module-scope
// handlers, utility modules) can request confirmations too. The provider
// swaps this in when it mounts.
let confirmDelegate: (options: ConfirmOptions) => Promise<boolean> = () =>
    Promise.resolve(false);

/**
 * Promise-based confirmation. Safe to call from anywhere — components
 * (no hook rules) and module-scope handlers alike. Resolves `true` when
 * the user confirms, `false` on cancel/dismiss. Resolves `false`
 * immediately if the provider is not mounted.
 */
export function confirmRequest(options: ConfirmOptions): Promise<boolean> {
    return confirmDelegate(options);
}

export function useConfirm() {
    return useContext(ConfirmContext);
}

/**
 * App-wide promise-based confirmation dialog.
 *
 * Replaces native `confirm()` with the styled Radix AlertDialog used
 * elsewhere in the app. Mount once (e.g. around the Inertia App) and call
 * `const ok = await confirm({ title, description })` from event handlers.
 */
export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<ConfirmState | null>(null);
    const stateRef = useRef<ConfirmState | null>(null);

    const confirm = useCallback((options: ConfirmOptions) => {
        // Resolve any pending dialog as cancelled before opening a new one.
        stateRef.current?.resolve(false);

        return new Promise<boolean>((resolve) => {
            const next = { ...options, resolve };
            stateRef.current = next;
            setState(next);
        });
    }, []);

    // Register the delegate so module-level callers route through this
    // provider's dialog while it is mounted.
    confirmDelegate = confirm;

    const settle = useCallback((ok: boolean) => {
        stateRef.current?.resolve(ok);
        stateRef.current = null;
        setState(null);
    }, []);

    return (
        <ConfirmContext.Provider value={confirm}>
            {children}

            <AlertDialog
                open={state !== null}
                onOpenChange={(open) => {
                    if (!open) settle(false);
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{state?.title}</AlertDialogTitle>
                        {state?.description && (
                            <AlertDialogDescription>
                                {state.description}
                            </AlertDialogDescription>
                        )}
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => settle(false)}>
                            {state?.cancelLabel ?? 'Cancel'}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => settle(true)}
                            className={
                                (state?.destructive ?? true)
                                    ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                                    : undefined
                            }
                        >
                            {state?.confirmLabel ?? 'Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </ConfirmContext.Provider>
    );
}
