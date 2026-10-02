import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CheckCircle2 } from 'lucide-react';

interface ApprovalCompletedBannerProps {
    /** Opens the subscription's editor so the dates can be recorded. */
    onEdit: () => void;
    editing?: boolean;
}

/**
 * Stands in for a chain that has finished while the subscription is still
 * missing its start or renewal date.
 *
 * The caller decides when to show this, so the banner stays a pure view: it
 * says what is true (the chain is done) and offers the one action that moves
 * the subscription forward. Once both dates are recorded the caller stops
 * rendering it, which is why there is no dismiss state here - hiding it would
 * be undone by the next visit.
 */
export default function ApprovalCompletedBanner({ onEdit, editing = false }: ApprovalCompletedBannerProps) {
    return (
        <Alert className="border-primary/40 bg-primary/5 text-foreground">
            <CheckCircle2 className="text-primary" />

            <AlertTitle>Approval is now complete. You may add the Dates.</AlertTitle>

            <AlertDescription>
                This subscription cleared its approval chain. Record its start and renewal dates to finish the record.
            </AlertDescription>

            {!editing && (
                <div className="col-start-2 mt-2">
                    <Button size="sm" onClick={onEdit}>
                        Add Dates
                    </Button>
                </div>
            )}
        </Alert>
    );
}