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
