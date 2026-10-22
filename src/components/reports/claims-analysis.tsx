'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Download, Plus } from 'lucide-react';
import { useState } from 'react';
import { inr } from '@/components/claims/claim-ui';
import { Pager } from '@/components/ghi/ghi-ui';
import { EmptyState, ErrorState, LoadingState, errorMessage } from '@/components/states';
import { PolicyPicker, Stat, TpaStatusBadge } from '@/components/tpa/tpa-ui';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { usePermission } from '@/hooks/use-permission';
import { apiDownload, apiFetch, saveFile } from '@/lib/api-client';
import {
  ageBandSetsQuery,
  claimsAnalysisParams,
  claimsAnalysisQuery,
  premiumAdjustmentsQuery,
  useReportMutation,
  type ClaimsAnalysisFilters,
} from '@/lib/api/reports';
import {
  CLAIM_TYPE_LABELS,
  GHI_RELATIONSHIPS,
  GHI_RELATIONSHIP_LABELS,
  OUTSTANDING_BASES,
  OUTSTANDING_BASIS_LABELS,
  PremiumAdjustmentSchema,
  TPA_CLAIM_STATUSES,
  TPA_CLAIM_STATUS_LABELS,
  TPA_CLAIM_TYPES,
  TPA_REQUEST_TYPES,
  TPA_REQUEST_TYPE_LABELS,
  formatDate,
  type AnalysisRow,
  type ClaimsAnalysis,
  type ClaimsAnalysisResponse,
  type OutstandingBasis,
} from '@/shared';

const EMPTY: ClaimsAnalysisFilters = {
  caseId: '',
  from: '',
  to: '',
  asOf: '',
  status: '',
  claimType: '',
  requestType: '',
  member: '',
  relationship: '',
  ageBandSetId: '',
  outstandingBasis: 'SANCTIONED_ELSE_CLAIMED',
  q: '',
  page: 1,
};

/**
 * The claims analysis of one policy (N10) from its imported TPA claims: by status, member,
 * gender, relationship, age band, claim type and disease, and the incurred claims ratio on the
 * prorated and the total premium. Every figure comes from the API; nothing is worked out here.
 */
export function ClaimsAnalysisPanel() {
  const [filters, setFilters] = useState<ClaimsAnalysisFilters>(EMPTY);
  const set = (patch: Partial<ClaimsAnalysisFilters>) =>
    setFilters((current) => ({ ...current, page: 1, ...patch }));
  const report = useQuery({ ...claimsAnalysisQuery(filters), placeholderData: keepPreviousData });
  const bands = useQuery(ageBandSetsQuery());
  const [downloading, setDownloading] = useState<'xlsx' | 'pdf' | null>(null);
  const [downloadError, setDownloadError] = useState<unknown>(null);
  const download = (format: 'xlsx' | 'pdf') => {
    setDownloading(format);
    setDownloadError(null);
    apiDownload(
      `claims-analysis/document?${claimsAnalysisParams(filters, false)}&format=${format}`,
      `Claims-analysis.${format}`,
    )
      .then(saveFile)
      .catch(setDownloadError)
      .finally(() => setDownloading(null));
  };

  return (
    <div className="grid gap-6">
      <Card>
        <CardContent className="grid gap-3 pt-6">
          <PolicyPicker
            value={filters.caseId}
            onChange={(caseId) => setFilters({ ...EMPTY, caseId })}
          />
          {filters.caseId ? (
            <div className="flex flex-wrap items-end gap-3">
              <DateFilter
                label="Admitted from"
                value={filters.from}
                onChange={(from) => set({ from })}
              />
              <DateFilter label="Admitted to" value={filters.to} onChange={(to) => set({ to })} />
              <DateFilter
                label="Premium earned to"
                value={filters.asOf}
                onChange={(asOf) => set({ asOf })}
              />
              <Choice
                label="Status"
                value={filters.status}
                onChange={(status) => set({ status: status as ClaimsAnalysisFilters['status'] })}
                options={TPA_CLAIM_STATUSES.map((value) => [value, TPA_CLAIM_STATUS_LABELS[value]])}
              />
              <Choice
                label="Claim type"
                value={filters.claimType}
                onChange={(claimType) =>
                  set({ claimType: claimType as ClaimsAnalysisFilters['claimType'] })
                }
                options={TPA_CLAIM_TYPES.map((value) => [value, CLAIM_TYPE_LABELS[value]])}
              />
              <Choice
                label="Request"
                value={filters.requestType}
                onChange={(requestType) =>
                  set({ requestType: requestType as ClaimsAnalysisFilters['requestType'] })
                }
                options={TPA_REQUEST_TYPES.map((value) => [value, TPA_REQUEST_TYPE_LABELS[value]])}
              />
              <Choice
                label="Member"
                value={filters.member}
                onChange={(member) => set({ member: member as ClaimsAnalysisFilters['member'] })}
                options={[
                  ['MAIN', 'Main member'],
                  ['DEPENDANT', 'Dependants'],
                ]}
              />
              <Choice
                label="Relationship"
                value={filters.relationship}
                onChange={(relationship) =>
                  set({ relationship: relationship as ClaimsAnalysisFilters['relationship'] })
                }
                options={GHI_RELATIONSHIPS.map((value) => [value, GHI_RELATIONSHIP_LABELS[value]])}
              />
              <Choice
                label="Age bands"
                value={filters.ageBandSetId}
                allLabel="Claims analysis bands"
                onChange={(ageBandSetId) => set({ ageBandSetId })}
                options={(bands.data?.items ?? []).map((item) => [item.id, item.name])}
              />
              <Label className="grid gap-1 text-sm font-normal">
                Outstanding reserved at
                <NativeSelect
                  className="w-72"
                  value={filters.outstandingBasis}
                  onChange={(event) =>
                    set({ outstandingBasis: event.target.value as OutstandingBasis })
                  }
                >
                  {OUTSTANDING_BASES.map((value) => (
                    <option key={value} value={value}>
                      {OUTSTANDING_BASIS_LABELS[value]}
                    </option>
                  ))}
                </NativeSelect>
              </Label>
              <Label className="grid gap-1 text-sm font-normal">
                Search
                <Input
                  className="w-48"
                  value={filters.q}
                  placeholder="Claim, employee, hospital"
                  onChange={(event) => set({ q: event.target.value })}
                />
              </Label>
            </div>
          ) : null}
        </CardContent>
      </Card>
      {!filters.caseId ? (
        <EmptyState
          title="Choose a policy"
          description="The analysis is of the TPA claims imported for that policy."
        />
      ) : report.isError ? (
        <ErrorState error={report.error} onRetry={() => void report.refetch()} />
      ) : !report.data ? (
        <LoadingState label="Working out the analysis" />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {report.data.header.company} ·{' '}
              {report.data.header.policyNumber ?? report.data.header.reference} · admissions{' '}
              {formatDate(report.data.header.from)} to {formatDate(report.data.header.to)} · premium
              earned to {formatDate(report.data.header.asOf)} · age bands:{' '}
              {report.data.header.ageBands.name}
            </p>
            <div className="flex gap-2">
              {(['xlsx', 'pdf'] as const).map((format) => (
                <Button
                  key={format}
                  variant="outline"
                  disabled={downloading !== null}
                  onClick={() => download(format)}
                >
                  <Download aria-hidden="true" />
                  {format === 'xlsx' ? 'Excel' : 'PDF'}
                </Button>
              ))}
            </div>
          </div>
          {downloadError ? (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage(downloadError)}</AlertDescription>
            </Alert>
          ) : null}
          {report.data.header.unreportedBoardClaims > 0 ? (
            <Alert>
              <AlertTitle>Board claims not in the TPA data</AlertTitle>
              <AlertDescription>
                {report.data.header.unreportedBoardClaims} claim(s) on the claims board have no TPA
                record yet and are not in these figures.
              </AlertDescription>
            </Alert>
          ) : null}
          <IcrCard data={report.data.analysis} />
          <div className="grid gap-6 xl:grid-cols-2">
            <AnalysisTable title="A. Status" rows={report.data.analysis.status} />
            <AnalysisTable
              title="Outstanding by TPA status"
              rows={report.data.analysis.outstandingBySubStatus}
            />
            <AnalysisTable
              title="B. Main member and dependants"
              rows={report.data.analysis.members}
            />
            <AnalysisTable title="C. Gender" rows={report.data.analysis.gender} />
            <AnalysisTable title="C. Relationship" rows={report.data.analysis.relationship} />
            <AnalysisTable
              title="C. Age band (age at admission)"
              rows={report.data.analysis.ageBands}
            />
            <AnalysisTable
              title="D. Cashless and reimbursement"
              rows={report.data.analysis.claimType}
            />
            <AnalysisTable
              title={`E. Disease (${report.data.analysis.icdVersion})`}
              rows={report.data.analysis.disease}
            />
          </div>
          <DetailsTable
            data={report.data}
            onPage={(page) => setFilters((current) => ({ ...current, page }))}
            page={filters.page}
          />
          <PremiumCard caseId={filters.caseId} />
        </>
      )}
    </div>
  );
}

function DateFilter({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Label className="grid gap-1 text-sm font-normal">
      {label}
      <Input
        type="date"
        className="w-40"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </Label>
  );
}

function Choice({
  label,
  value,
  onChange,
  options,
  allLabel = 'All',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
  allLabel?: string;
}) {
  return (
    <Label className="grid gap-1 text-sm font-normal">
      {label}
      <NativeSelect
        className="w-44"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{allLabel}</option>
        {options.map(([key, text]) => (
          <option key={key} value={key}>
            {text}
          </option>
        ))}
      </NativeSelect>
    </Label>
  );
}

function IcrCard({ data }: { data: ClaimsAnalysis }) {
  const { icr, premium } = data;
  const percent = (value: { percent: string | null; reason: string | null }) =>
    value.percent === null ? (
      <span className="text-sm font-normal text-muted-foreground">{value.reason}</span>
    ) : (
      `${value.percent}%`
    );
  return (
    <Card>
      <CardHeader>
        <CardTitle>F. Incurred claims ratio</CardTitle>
        <CardDescription>
          ICR = (paid + outstanding) ÷ premium × 100. Premiums are before GST. Outstanding claims
          are reserved at {OUTSTANDING_BASIS_LABELS[data.outstandingBasis].toLowerCase()}.
          {data.notCounted > 0
            ? ` ${data.notCounted} pre-authorisation(s) linked to their main claim are not counted again.`
            : ''}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Stat label="Claims counted" value={data.reported.count} />
          <Stat label="Paid" value={inr(icr.paid)} />
          <Stat label="Outstanding" value={inr(icr.outstanding)} />
          <Stat label="Incurred" value={inr(icr.incurred)} />
          <Stat label="Premium as placed" value={inr(premium.base)} />
          <Stat
            label="Additions − deletions"
            value={`${inr(premium.additions)} − ${inr(premium.deletions)}`}
          />
          <Stat label="Total premium" value={inr(premium.total)} />
          <Stat
            label={`Prorated premium (${premium.daysElapsed} of ${premium.policyDays} days)`}
            value={inr(premium.prorated)}
          />
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Stat label="ICR on the prorated premium" value={percent(icr.prorated)} />
          <Stat label="ICR on the total premium" value={percent(icr.total)} />
        </div>
      </CardContent>
    </Card>
  );
}

function AnalysisTable({ title, rows }: { title: string; rows: AnalysisRow[] }) {
  const count = rows.reduce((sum, row) => sum + row.count, 0);
  return (
    <section className="grid gap-2">
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead />
              <TableHead className="text-right">Claims</TableHead>
              <TableHead className="text-right">Claimed</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Outstanding</TableHead>
              <TableHead className="text-right">Incurred</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  No claims
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.key}>
                  <TableCell>{row.label}</TableCell>
                  <TableCell className="text-right tabular">{row.count}</TableCell>
                  <TableCell className="text-right tabular">{inr(row.claimed)}</TableCell>
                  <TableCell className="text-right tabular">{inr(row.paid)}</TableCell>
                  <TableCell className="text-right tabular">{inr(row.outstanding)}</TableCell>
                  <TableCell className="text-right tabular">{inr(row.incurred)}</TableCell>
                </TableRow>
              ))
            )}
            {rows.length > 0 ? (
              <TableRow className="font-semibold">
                <TableCell>Total</TableCell>
                <TableCell className="text-right tabular">{count}</TableCell>
                <TableCell colSpan={4} />
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

function DetailsTable({
  data,
  page,
  onPage,
}: {
  data: ClaimsAnalysisResponse;
  page: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(data.details.total / data.details.limit));
  const diagnosis = data.header.diagnosisVisible;
  return (
    <section className="grid gap-2">
      <h2 className="text-sm font-semibold">Claims in the figures</h2>
      <div
        role="region"
        aria-label="Claims in the analysis"
        tabIndex={0}
        className="overflow-x-auto rounded-md border"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>TPA claim</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Patient</TableHead>
              <TableHead className="text-right">Age</TableHead>
              <TableHead>Admitted</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Claimed</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Outstanding</TableHead>
              <TableHead>Disease group</TableHead>
              {diagnosis ? <TableHead>ICD code</TableHead> : null}
              {diagnosis ? <TableHead>Diagnosis</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.details.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={diagnosis ? 12 : 10}>
                  <EmptyState title="No claims" description="No claim matches the filters." />
                </TableCell>
              </TableRow>
            ) : (
              data.details.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    {item.tpaClaimId}
                    <span className="block text-xs text-muted-foreground">
                      {TPA_REQUEST_TYPE_LABELS[item.requestType]}
                    </span>
                  </TableCell>
                  <TableCell>
                    {item.bucket === 'NOT_COUNTED' ? (
                      <Badge variant="muted">Part of its main claim</Badge>
                    ) : (
                      <TpaStatusBadge status={item.bucket} source={item.sourceStatus} />
                    )}
                  </TableCell>
                  <TableCell>
                    {item.patientName ?? '—'}
                    <span className="block text-xs text-muted-foreground">
                      {item.employeeId ?? ''}
                      {item.relationship ? ` · ${GHI_RELATIONSHIP_LABELS[item.relationship]}` : ''}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular">{item.age ?? '—'}</TableCell>
                  <TableCell className="tabular">
                    {item.admissionDate ? formatDate(item.admissionDate) : '—'}
                  </TableCell>
                  <TableCell>{item.claimType ? CLAIM_TYPE_LABELS[item.claimType] : '—'}</TableCell>
                  <TableCell className="text-right tabular">{inr(item.claimedAmount)}</TableCell>
                  <TableCell className="text-right tabular">{inr(item.paid)}</TableCell>
                  <TableCell className="text-right tabular">{inr(item.outstanding)}</TableCell>
                  <TableCell>{item.icdChapter}</TableCell>
                  {diagnosis ? <TableCell>{item.icdCode ?? '—'}</TableCell> : null}
                  {diagnosis ? <TableCell>{item.diagnosis ?? '—'}</TableCell> : null}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <Pager page={page} pages={pages} total={data.details.total} onPage={onPage} />
    </section>
  );
}

/** Endorsement premiums (additions and deletions) for the ICR; voided, never deleted. */
function PremiumCard({ caseId }: { caseId: string }) {
  const canEdit = usePermission('proposals.edit');
  const list = useQuery(premiumAdjustmentsQuery(caseId));
  const [draft, setDraft] = useState({
    kind: 'ADDITION' as 'ADDITION' | 'DELETION',
    amount: '',
    effectiveDate: '',
    reference: '',
    note: '',
  });
  const add = useReportMutation(
    () =>
      apiFetch(`claims-analysis/premium/${caseId}`, {
        method: 'POST',
        body: { ...draft, note: draft.note.trim() || null },
        schema: PremiumAdjustmentSchema,
      }),
    () => {
      setDraft({ kind: 'ADDITION', amount: '', effectiveDate: '', reference: '', note: '' });
      return { title: 'Endorsement premium recorded' };
    },
  );
  const voidOne = useReportMutation(
    (id: string) =>
      apiFetch(`claims-analysis/premium/${caseId}/${id}/void`, {
        method: 'POST',
        schema: PremiumAdjustmentSchema,
      }),
    () => ({ title: 'Endorsement premium voided' }),
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>Endorsement premiums</CardTitle>
        <CardDescription>
          Additions and deletions of members during the year, before GST, each earned from its
          effective date to the policy end.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {list.isError ? (
          <ErrorState error={list.error} onRetry={() => void list.refetch()} />
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kind</TableHead>
                  <TableHead className="text-right">Premium</TableHead>
                  <TableHead>Effective</TableHead>
                  <TableHead>Endorsement</TableHead>
                  <TableHead>Recorded</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(list.data?.items ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      None recorded
                    </TableCell>
                  </TableRow>
                ) : (
                  list.data!.items.map((item) => (
                    <TableRow key={item.id} className={item.voided ? 'opacity-60' : undefined}>
                      <TableCell>
                        {item.kind === 'ADDITION' ? 'Addition' : 'Deletion'}
                        {item.voided ? (
                          <Badge variant="muted" className="ml-2">
                            Voided
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right tabular">{inr(item.amount)}</TableCell>
                      <TableCell className="tabular">{formatDate(item.effectiveDate)}</TableCell>
                      <TableCell>
                        {item.reference}
                        {item.note ? (
                          <span className="block text-xs text-muted-foreground">{item.note}</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {item.createdBy}
                      </TableCell>
                      <TableCell>
                        {canEdit && !item.voided ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={voidOne.isPending}
                            onClick={() => voidOne.mutate(item.id)}
                          >
                            Void
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
        {canEdit ? (
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              add.mutate(undefined);
            }}
          >
            <Label className="grid gap-1 text-sm font-normal">
              Kind
              <NativeSelect
                className="w-36"
                value={draft.kind}
                onChange={(event) =>
                  setDraft({ ...draft, kind: event.target.value as typeof draft.kind })
                }
              >
                <option value="ADDITION">Addition</option>
                <option value="DELETION">Deletion</option>
              </NativeSelect>
            </Label>
            <Label className="grid gap-1 text-sm font-normal">
              Premium before GST (₹)
              <Input
                className="w-40"
                inputMode="decimal"
                value={draft.amount}
                onChange={(event) => setDraft({ ...draft, amount: event.target.value })}
              />
            </Label>
            <Label className="grid gap-1 text-sm font-normal">
              Effective from
              <Input
                type="date"
                className="w-40"
                value={draft.effectiveDate}
                onChange={(event) => setDraft({ ...draft, effectiveDate: event.target.value })}
              />
            </Label>
            <Label className="grid gap-1 text-sm font-normal">
              Endorsement reference
              <Input
                className="w-44"
                value={draft.reference}
                onChange={(event) => setDraft({ ...draft, reference: event.target.value })}
              />
            </Label>
            <Label className="grid gap-1 text-sm font-normal">
              Note
              <Input
                className="w-56"
                value={draft.note}
                onChange={(event) => setDraft({ ...draft, note: event.target.value })}
              />
            </Label>
            <Button type="submit" disabled={add.isPending}>
              <Plus aria-hidden="true" />
              Record
            </Button>
          </form>
        ) : null}
        {add.error || voidOne.error ? (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage(add.error ?? voidOne.error)}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
