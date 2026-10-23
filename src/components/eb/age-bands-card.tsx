'use client';

import { useQuery } from '@tanstack/react-query';
import { CalendarRange, LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { ErrorState, LoadingState, errorMessage } from '@/components/states';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { NativeSelect } from '@/components/ui/native-select';
import { usePermission } from '@/hooks/use-permission';
import { apiFetch } from '@/lib/api-client';
import { AnyRecordSchema, caseApi, useGhiMutation } from '@/lib/api/ghi';
import { ageBandSetsQuery } from '@/lib/eb/api';
import {
  bandsRangeText,
  casePermission,
  formatDateTime,
  STANDARD_AGE_BANDS,
  STANDARD_AGE_BANDS_NAME,
  type AgeBandSelection,
  type EbProduct,
} from '@/shared';

/**
 * The age bands a case uses (N4): its copy of a set from the Age Band Master, or the standard
 * bands. The census summary, the RFQ and the selection summary follow them. Choosing again takes
 * the set's current revision and makes an RFQ generated before out of date.
 */
export function AgeBandsCard({
  caseId,
  product,
  selection,
  editable,
}: {
  caseId: string;
  product: EbProduct;
  selection: AgeBandSelection | null;
  /** The case is open, the RFQ not sent and the case not placed. */
  editable: boolean;
}) {
  const canEdit = usePermission(casePermission(product, 'edit'));
  const [open, setOpen] = useState(false);
  const sets = useQuery(ageBandSetsQuery());
  const master = selection
    ? sets.data?.items.find((item) => item.id === selection.setId)
    : undefined;
  const bands = selection?.bands ?? STANDARD_AGE_BANDS;
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <CardTitle className="flex items-center gap-2">
            <CalendarRange aria-hidden="true" className="size-4 text-primary" />
            Age bands
          </CardTitle>
          <CardDescription>
            For the census summary, the RFQ and the RFQ selection summary.
          </CardDescription>
        </div>
        {canEdit && editable ? (
          <Button type="button" variant="outline" onClick={() => setOpen(true)}>
            Choose age bands
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="grid gap-2 text-sm">
        <p className="font-medium">
          {selection
            ? `${selection.name} · revision ${selection.revision}`
            : STANDARD_AGE_BANDS_NAME}
        </p>
        <p className="text-muted-foreground">
          {bands.map((band) => band.label).join(', ')} (ages {bandsRangeText(bands)})
          {selection
            ? ` · chosen by ${selection.selectedBy} on ${formatDateTime(selection.selectedAt)}`
            : ''}
        </p>
        {selection && master && master.revision !== selection.revision ? (
          <Alert variant="info">
            <AlertDescription>
              The set is now at revision {master.revision}; this case keeps revision{' '}
              {selection.revision} until the set is chosen again.
            </AlertDescription>
          </Alert>
        ) : null}
        {selection && master && !master.active ? (
          <Alert variant="warning">
            <AlertDescription>
              The set has been deactivated; the case keeps its copy.
            </AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
      {open ? (
        <ChooseDialog
          caseId={caseId}
          product={product}
          current={selection?.setId ?? null}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </Card>
  );
}

function ChooseDialog({
  caseId,
  product,
  current,
  onClose,
}: {
  caseId: string;
  product: EbProduct;
  current: string | null;
  onClose: () => void;
}) {
  const sets = useQuery(ageBandSetsQuery());
  const [setId, setSetId] = useState(current ?? '');
  const choose = useGhiMutation(
    caseId,
    () =>
      apiFetch(`${caseApi(product, caseId)}/age-bands`, {
        method: 'PUT',
        body: { setId: setId === '' ? null : setId },
        schema: AnyRecordSchema,
      }),
    () => ({ title: 'Age bands chosen', description: 'The summaries now follow them.' }),
  );
  const active = sets.data?.items.filter((item) => item.active) ?? [];
  const chosen = active.find((item) => item.id === setId);
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Choose the age bands</DialogTitle>
          <DialogDescription>
            The case takes a copy of the set as it is now. An RFQ already generated becomes out of
            date and is generated again; its own copy does not change.
          </DialogDescription>
        </DialogHeader>
        {sets.isPending ? (
          <LoadingState label="Loading the age band sets" />
        ) : sets.isError ? (
          <ErrorState error={sets.error} onRetry={() => void sets.refetch()} />
        ) : (
          <div className="grid gap-2 text-sm">
            <NativeSelect
              aria-label="Age band set"
              value={setId}
              onChange={(event) => setSetId(event.target.value)}
            >
              <option value="">{STANDARD_AGE_BANDS_NAME}</option>
              {active.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} (revision {item.revision})
                </option>
              ))}
            </NativeSelect>
            <p className="text-muted-foreground">
              {(chosen?.bands ?? STANDARD_AGE_BANDS).map((band) => band.label).join(', ')}
            </p>
          </div>
        )}
        {choose.isError ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{errorMessage(choose.error)}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={choose.isPending || sets.isPending}
            onClick={() => choose.mutate(undefined, { onSuccess: onClose })}
          >
            {choose.isPending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
            Use these bands
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
