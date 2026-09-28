import { router } from '@inertiajs/react';

/**
 * Navigate to a deterministic back destination.
 *
 * Priority:
 *   1. A resolved `preferred` back URL (e.g. a backend-provided `backUrl`, or
 *      an origin the linking page declared via `?from=`).
 *   2. The caller's `defaultUrl` (the page's parent).
 *
 * We deliberately avoid `window.history.back()` inside the Inertia SPA because
 * it desyncs from Inertia's history model (especially after a hard refresh) and
 * leaves the user "stuck" on the same page. We also avoid `document.referrer`
 * inference — it is never updated on client-side navigations, so it points at a
 * stale page and makes Back feel random.
 *
 * Navigation goes through Inertia so scroll/state/history stay consistent.
 *
 * @param defaultUrl Deterministic destination (the page's parent).
 * @param preferred  A known/resolved back URL, when the origin is known.
 */
export function goBack(defaultUrl: string, preferred?: string | null): void {
    const target = preferred || defaultUrl;
    router.visit(target, {
        preserveScroll: true,
        preserveState: false,
        replace: false,
    });
}