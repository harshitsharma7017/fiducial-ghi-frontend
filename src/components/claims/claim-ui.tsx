'use client';

import { useQuery } from '@tanstack/react-query';
import { LoaderCircle } from 'lucide-react';
import type * as React from 'react';
import { useState } from 'react';
import { errorMessage } from '@/components/states';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api-client';
import { issuesText, useClaimMutation } from '@/lib/api/claims';
import {
  CLAIM_STATUS_LABELS,
  ClientListResponseSchema,
  TransitionClaimResponseSchema,
  formatIndianNumber,
  type ClaimStatus,
  type TransitionClaimResponse,
} from '@/shared';

type Variant = React.ComponentProps<typeof Badge>['variant'];
const STATUS_VARIANT: Record<ClaimStatus, Variant> = {
  FORM: 'muted',
  SUBMITTED: 'info',
  INVESTIGATION: 'warning',
  APPROVED: 'success',
};

export function ClaimStatusBadge({ status }: { status: ClaimStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{CLAIM_STATUS_LABELS[status]}</Badge>;
}

/** Rupees with paise, Indian grouping: ₹48,500.50. */
export const inr = (value: string | null) =>
  value === null ? '—' : `₹${formatIndianNumber(value, 2)}`;

export const daysText = (days: number) =>
  days === 0 ? 'Today' : days === 1 ? '1 day' : `${days} days`;

/** The companies to filter by (the client master). */
export function CompanyFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const clients = useQuery({
    queryKey: ['clients', 'list', '', 'claims'],
    queryFn: ({ signal }) =>
      apiFetch('clients?limit=100', { schema: ClientListResponseSchema, signal }),
  });
  return (
    <NativeSelect
      aria-label="Company"
      className="w-56"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">All companies</option>
      {(clients.data?.items ?? []).map((client) => (
        <option key={client.id} value={client.id}>
          {client.name}
        </option>
      ))}
    </NativeSelect>
  );
}

export interface PendingMove {
  claimId: string;
  claimNumber: string;
  from: ClaimStatus;
  to: ClaimStatus;
}

/**
 * Asks for the staff remark every move needs (C1), then moves the claim. The API saves the move
 * and queues the emails; the result says how each email went.
 */
export function MoveDialog({
  move,
  onClose,
}: {
  move: PendingMove | null;
  onClose: (result: TransitionClaimResponse | null) => void;
}) {
  const [remark, setRemark] = useState('');
  const save = useClaimMutation(
    (body: { move: PendingMove; remark: string }) =>
      apiFetch(`claims/${body.move.claimId}/transitions`, {
        method: 'POST',
        body: { toStatus: body.move.to, expectedStatus: body.move.from, remark: body.remark },
        schema: TransitionClaimResponseSchema,
      }),
    (result) => {
      const failed = result.notifications.filter(
        (item) => item.status === 'FAILED' || item.status === 'PENDING',
      );
      return {
        title: `${result.claim.claimNumber} moved to ${CLAIM_STATUS_LABELS[result.claim.status]}`,
        description:
          result.notifications.length === 0
            ? 'No email was due.'
            : failed.length > 0
              ? `${failed.length} of ${result.notifications.length} email(s) not sent yet: see the claim’s timeline.`
              : `${result.notifications.length} email(s) accepted by the mail server.`,
      };
    },
  );
  const close = (result: TransitionClaimResponse | null) => {
    setRemark('');
    save.reset();
    onClose(result);
  };
  return (
    <Dialog open={move !== null} onOpenChange={(open) => (open ? undefined : close(null))}>
      <DialogContent>
        {move ? (
          <>
            <DialogHeader>
              <DialogTitle>
                Move {move.claimNumber} to {CLAIM_STATUS_LABELS[move.to]}
              </DialogTitle>
              <DialogDescription>
                From {CLAIM_STATUS_LABELS[move.from]}. The remark goes on the timeline and in the
                emails to the claimant and, when set up, the company’s HR.
              </DialogDescription>
            </DialogHeader>
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                save.mutate({ move, remark }, { onSuccess: (result) => close(result) });
              }}
            >
              <Label className="grid gap-1 text-sm font-normal">
                Remark (required)
                <Textarea
                  rows={3}
                  maxLength={1000}
                  value={remark}
                  onChange={(event) => setRemark(event.target.value)}
                  autoFocus
                />
              </Label>
              {save.isError ? (
                <Alert variant="destructive" role="alert">
                  <AlertDescription>
                    {issuesText(save.error) ?? errorMessage(save.error)}
                  </AlertDescription>
                </Alert>
              ) : null}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => close(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={save.isPending || !remark.trim()}>
                  {save.isPending ? (
                    <LoaderCircle className="animate-spin" aria-hidden="true" />
                  ) : null}
                  Move to {CLAIM_STATUS_LABELS[move.to]}
                </Button>
              </DialogFooter>
            </form>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
