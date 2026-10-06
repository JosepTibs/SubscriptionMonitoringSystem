export function formatPeso(value: string | number | null | undefined): string {
    if (value === null || value === undefined || value === '') {
        return '—';
    }

    return '₱' + Number(value).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDate(value: string | null | undefined): string {
    if (!value) {
        return '—';
    }

    return new Date(value).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function billingIntervalLabel(interval: number, unit: 'month' | 'year'): string {
    const unitLabel = unit === 'month' ? 'month' : 'year';

    return interval === 1 ? `Every ${unitLabel}` : `Every ${interval} ${unitLabel}s`;
}

/**
 * Normalize anything the API may send for a date (Y-m-d, full ISO
 * `2026-05-01T00:00:00.000000Z`, null) into the exact `YYYY-MM-DD` shape a
 * native `<input type="date">` requires. Anything unparseable becomes ''
 * so the input renders empty instead of silently holding a bad value.
 */
export function toDateInputValue(value: string | null | undefined): string {
    if (value === null || value === undefined) {
        return '';
    }

    // '2026-05-01...' -> '2026-05-01'. Slicing is timezone-safe, unlike
    // new Date(...).toISOString(), which can shift the day for +08:00 dates.
    const candidate = String(value).slice(0, 10);

    return /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : '';
}
