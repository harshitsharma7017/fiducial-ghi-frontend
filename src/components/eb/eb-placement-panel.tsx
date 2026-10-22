'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleAlert, CircleCheck, LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { DownloadButton, Fact, inr, rupees } from '@/components/ghi/ghi-ui';
import { ErrorState, LoadingState, errorMessage } from '@/components/states';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { usePermission } from '@/hooks/use-permission';
import { apiFetch } from '@/lib/api-client';
import { AnyRecordSchema, caseApi, refreshGhiCase } from '@/lib/api/ghi';
import { ebPlacementQuery } from '@/lib/eb/api';
import { formatDate, formatDateTime, sumMoney, type EbCaseRecord } from '@/shared';
import { AwaitingNote } from './awaiting-confirmation';
import { Field } from './eb-ui';

/**
 * The placement slip (Requirement 11): what it still needs, its download, and issuing it, which
 * places the case and freezes its census, plan and premium in a snapshot. Placing needs no
 * Final QCR or policy step (open question 1); the policy number and dates are optional (Q2).
 */
export function EbPlacementPanel({ record }: { record: EbCaseRecord }) {
  const queryClient = useQueryClient();
  const canEdit = usePermission('proposals.edit');
  const canExport = usePermission('proposals.export');
  const placement = useQuery(ebPlacementQuery(record.product, record.id));
  const [policyNumber, setPolicyNumber] = useState('');
  const [policyStart, setPolicyStart] = useState(record.policyStart ?? '');
  const [policyEnd, setPolicyEnd] = useState(record.policyEnd ?? '');
  const issue = useMutation({
    mutationFn: () =>
      apiFetch(`${caseApi(record.product, record.id)}/placement`, {
        method: 'POST',
        body: { policyNumber, policyStart, policyEnd },
        schema: AnyRecordSchema,
      }),
    onSuccess: () => refreshGhiCase(queryClient, record.id),
  });
  if (placement.isPending) return <LoadingState label="Loading the placement" />;
  if (placement.isError)
    return <ErrorState error={placement.error} onRetry={() => void placement.refetch()} />;
  const state = placement.data;
  const base = caseApi(record.product, record.id);
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <CardTitle>Placement slip</CardTitle>
          <CardDescription>
            In Fiducial’s built-in layout (the client’s layout has not been received).
          </CardDescription>
        </div>
        {canExport && (state.placed || state.missing.length === 0) ? (
          <div className="flex gap-2">
            <DownloadButton
              path={`${base}/placement-slip?format=xlsx`}
              fallbackName={`${record.product}-Placement-Slip.xlsx`}
            >
              Excel
            </DownloadButton>
            <DownloadButton
              path={`${base}/placement-slip?format=pdf`}
              fallbackName={`${record.product}-Placement-Slip.pdf`}
            >
              PDF
            </DownloadButton>
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="grid gap-4">
        {state.placed ? (
          <Alert variant="success">
            <CircleCheck aria-hidden="true" />
            <AlertTitle>
              Placed{state.policyNumber ? `: policy ${state.policyNumber}` : ''}
            </AlertTitle>
            <AlertDescription>
              Issued by {state.issuedBy} on {state.issuedAt ? formatDateTime(state.issuedAt) : ''}
              {state.policyStart
                ? ` · ${formatDate(state.policyStart)} to ${state.policyEnd ? formatDate(state.policyEnd) : '—'}`
                : ''}
              . The census, plan and premium are frozen with the placement.
            </AlertDescription>
          </Alert>
        ) : state.missing.length > 0 ? (
          <Alert variant="warning">
            <CircleAlert aria-hidden="true" />
            <AlertTitle>Before the placement slip</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-4">
                {state.missing.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : null}
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
          <Fact label="Insurer">{state.insurerName ?? '—'}</Fact>
          <Fact label="Quote version">{state.quoteVersion ? `v${state.quoteVersion}` : '—'}</Fact>
          <Fact label="Agreed premium">{inr(state.agreedPremium)}</Fact>
          <Fact label="Received">
            {inr(sumMoney(state.receivedPayments.map((item) => item.amount)))}
          </Fact>
          <Fact label="Employees">{state.summary.employees}</Fact>
          <Fact label="Lives">{state.summary.lives}</Fact>
          <Fact label="Total sum insured">{rupees(state.summary.totalSumInsured)}</Fact>
          <Fact label="Plan">
            {state.plan ? `${state.plan.name} v${state.plan.versionNumber}` : '—'}
          </Fact>
        </dl>
        {!state.placed && state.ready && canEdit ? (
          <form
            noValidate
            className="grid gap-3 rounded-md border p-3 sm:grid-cols-3"
            onSubmit={(event) => {
              event.preventDefault();
              issue.mutate();
            }}
          >
            <div className="sm:col-span-3">
              <AwaitingNote>
                Whether the policy number and copy are recorded for GPA and GTLI awaits the client’s
                confirmation (open question 2): they are optional.
              </AwaitingNote>
            </div>
            <Field label="Policy number (optional)">
              <Input
                maxLength={50}
                value={policyNumber}
                onChange={(event) => setPolicyNumber(event.target.value)}
              />
            </Field>
            <Field label="Policy start (optional)">
              <Input
                type="date"
                value={policyStart}
                onChange={(event) => setPolicyStart(event.target.value)}
              />
            </Field>
            <Field label="Policy end (optional)">
              <Input
                type="date"
                value={policyEnd}
                onChange={(event) => setPolicyEnd(event.target.value)}
              />
            </Field>
            {issue.isError ? (
              <Alert variant="destructive" role="alert" className="sm:col-span-3">
                <AlertDescription>{errorMessage(issue.error)}</AlertDescription>
              </Alert>
            ) : null}
            <div className="sm:col-span-3">
              <Button type="submit" disabled={issue.isPending}>
                {issue.isPending ? (
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                ) : null}
                Issue the placement slip
              </Button>
            </div>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
