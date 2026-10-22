import { CircleAlert, FileWarning } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { PROVISIONAL_TEMPLATE_NOTICE, awaitingText } from '@/shared';

/**
 * "Awaiting client confirmation" with the open questions, on a plan version the client has not
 * confirmed (Requirement 14.6), or on a default the client still has to confirm.
 */
export function AwaitingConfirmationBadge({ openQuestions }: { openQuestions: readonly number[] }) {
  return (
    <Badge variant="warning" title={awaitingText(openQuestions)}>
      <CircleAlert aria-hidden="true" className="size-3" />
      {awaitingText(openQuestions)}
    </Badge>
  );
}

/** A note that a rule or step is a default awaiting the client's confirmation (open questions). */
export function AwaitingNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-xs text-warning">
      <CircleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/** The provisional notice beside every template download (Requirement 19.5). */
export function ProvisionalNotice() {
  return (
    <Alert variant="warning">
      <FileWarning aria-hidden="true" />
      <AlertTitle>Provisional template</AlertTitle>
      <AlertDescription>{PROVISIONAL_TEMPLATE_NOTICE}</AlertDescription>
    </Alert>
  );
}
