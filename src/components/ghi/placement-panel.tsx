'use client';

import { useQuery } from '@tanstack/react-query';
import { CircleAlert, CircleCheck, LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { ErrorState, LoadingState, errorMessage } from '@/components/states';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { usePermission } from '@/hooks/use-permission';
import { apiFetch } from '@/lib/api-client';
import { ghiFileHref, ghiPlacementQuery, issuesText, useGhiMutation } from '@/lib/api/ghi';
import { addDays, todayIst } from '@/lib/dates';
import {
  GhiCaseRecordSchema,
  formatDate,
  formatDateTime,
  type GhiCaseRecord,
  type RecordGhiPolicyRequest,
} from '@/shared';
import { Field } from './case-actions';
import { DownloadButton, Fact, FilePicker, inr, rupees } from './ghi-ui';

/**
 * The placement slip from the accepted QCR and final terms, with the census annexure, and the
 * policy the insurer issued: number, copy and renewal date (G7).
 */
export function PlacementPanel({ record }: { record: GhiCaseRecord }) {
  const canExport = usePermission('gmc.export');
  const canEdit = usePermission('gmc.edit');
  const placement = useQuery(ghiPlacementQuery(record.id));
  if (placement.isPending) return <LoadingState label="Loading the placement" />;
  if (placement.isError)
    return <ErrorState error={placement.error} onRetry={() => void placement.refetch()} />;
  const state = placement.data;
  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            <CardTitle>Placement slip</CardTitle>
            <CardDescription>
              The selected insurer, the final agreed terms, the census summary and every member as
              an annexure.
            </CardDescription>
          </div>
          {state.ready && canExport ? (
            <div className="flex flex-wrap gap-2">
              <DownloadButton
                path={`ghi/cases/${record.id}/placement-slip?format=xlsx`}
                fallbackName="GHI-Placement-Slip.xlsx"
              >
                Excel
              </DownloadButton>
              <DownloadButton
                path={`ghi/cases/${record.id}/placement-slip?format=pdf`}
                fallbackName="GHI-Placement-Slip.pdf"
              >
                PDF
              </DownloadButton>
            </div>
          ) : null}
        </CardHeader>
        <CardContent className="grid gap-4">
          {state.missing.length > 0 ? (
            <Alert variant="info">
              <CircleAlert aria-hidden="true" />
              <AlertTitle>Not ready yet</AlertTitle>
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
            <Fact label="Final total premium">{inr(state.finalQuote?.totalPremium ?? null)}</Fact>
            <Fact label="Employees / lives">
              {state.summary.employees} / {state.summary.lives}
            </Fact>
            <Fact label="Total sum insured">{rupees(state.summary.totalSumInsured)}</Fact>
          </dl>
        </CardContent>
      </Card>
      {record.policy ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CircleCheck aria-hidden="true" className="size-5 text-success" />
              Policy {record.policy.policyNumber}
            </CardTitle>
            <CardDescription>
              Recorded by {record.policy.recordedBy}, {formatDateTime(record.policy.recordedAt)}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
              <Fact label="Insurer">{record.policy.insurerName}</Fact>
              <Fact label="Issued on">{formatDate(record.policy.issuedOn)}</Fact>
              <Fact label="Period">
                {formatDate(record.policy.policyStart)} – {formatDate(record.policy.policyEnd)}
              </Fact>
              <Fact label="Renewal date">{formatDate(record.policy.renewalDate)}</Fact>
              <Fact label="Census insured">
                {record.policy.census.employees} employees, {record.policy.census.lives} lives
              </Fact>
              <Fact label="Total sum insured">{rupees(record.policy.census.totalSumInsured)}</Fact>
              <Fact label="Policy copy">
                <a
                  className="text-accent-strong hover:underline"
                  href={ghiFileHref(record.id, record.policy.file.id)}
                >
                  {record.policy.file.fileName}
                </a>
              </Fact>
            </dl>
          </CardContent>
        </Card>
      ) : null}
      {state.ready && canEdit ? <PolicyForm record={record} /> : null}
    </div>
  );
}

function PolicyForm({ record }: { record: GhiCaseRecord }) {
  const policy = record.policy;
  const start = policy?.policyStart ?? record.policyStart ?? todayIst();
  const [values, setValues] = useState<RecordGhiPolicyRequest>(() => ({
    policyNumber: policy?.policyNumber ?? '',
    issuedOn: policy?.issuedOn ?? todayIst(),
    policyStart: start,
    policyEnd: policy?.policyEnd ?? record.policyEnd ?? addDays(addDays(start, 365), -1),
    renewalDate: policy?.renewalDate ?? addDays(record.policyEnd ?? addDays(start, 364), 1),
    fileId: policy?.file.id ?? '',
  }));
  const set = (patch: Partial<RecordGhiPolicyRequest>) =>
    setValues((current) => ({ ...current, ...patch }));
  const save = useGhiMutation(
    record.id,
    () =>
      apiFetch(`ghi/cases/${record.id}/policy`, {
        method: 'PUT',
        body: values,
        schema: GhiCaseRecordSchema,
      }),
    () => ({
      title: policy ? 'Policy corrected' : 'Policy recorded',
      description: 'The case is placed.',
    }),
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>{policy ? 'Correct the policy' : 'Record the policy'}</CardTitle>
        <CardDescription>
          Linked to the company, this case, the selected insurer and the census as it stands.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate(undefined);
          }}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Policy number">
              <Input
                maxLength={100}
                value={values.policyNumber}
                onChange={(event) => set({ policyNumber: event.target.value })}
              />
            </Field>
            <Field label="Issued on">
              <Input
                type="date"
                max={todayIst()}
                value={values.issuedOn}
                onChange={(event) => set({ issuedOn: event.target.value })}
              />
            </Field>
            <Field label="Renewal date">
              <Input
                type="date"
                value={values.renewalDate}
                onChange={(event) => set({ renewalDate: event.target.value })}
              />
            </Field>
            <Field label="Policy period from">
              <Input
                type="date"
                value={values.policyStart}
                onChange={(event) => set({ policyStart: event.target.value })}
              />
            </Field>
            <Field label="Policy period to">
              <Input
                type="date"
                value={values.policyEnd}
                onChange={(event) => set({ policyEnd: event.target.value })}
              />
            </Field>
          </div>
          <FilePicker
            caseId={record.id}
            purpose="POLICY"
            label="Policy copy (tick one)"
            value={values.fileId ? [values.fileId] : []}
            onChange={(ids) => set({ fileId: ids.at(-1) ?? '' })}
          />
          {save.isError ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>
                {issuesText(save.error) ?? errorMessage(save.error)}
              </AlertDescription>
            </Alert>
          ) : null}
          <div className="flex justify-end">
            <Button type="submit" disabled={save.isPending || !values.fileId}>
              {save.isPending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
              {policy ? 'Save correction' : 'Record policy'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
