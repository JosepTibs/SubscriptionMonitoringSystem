import { Badge } from '@/components/ui/badge';

const statusStyles: Record<string, string> = {
    active: 'bg-primary/10 text-primary',
    expired: 'bg-destructive/10 text-destructive',
    cancelled: 'bg-muted text-muted-foreground',
    suspended: 'bg-chart-4/15 text-chart-4',
    pending_approval: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
};

export default function StatusBadge({ status }: { status: string }) {
    return (
        <Badge variant="secondary" className={statusStyles[status] ?? 'bg-muted text-muted-foreground'}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
        </Badge>
    );
}
