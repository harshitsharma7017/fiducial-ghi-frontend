'use client';

import { useQuery } from '@tanstack/react-query';
import { Download, Pencil, Plus, Save } from 'lucide-react';
import { Fragment, useState } from 'react';
import { inr } from '@/components/claims/claim-ui';
import { EmptyState, ErrorState, LoadingState, errorMessage } from '@/components/states';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { issuesText } from '@/lib/api/claims';
import {
  recordedYearsQuery,
  renewalAnalysisQuery,
  renewalOptionsQuery,
  savedReportQuery,
  savedReportsQuery,
  useReportMutation,
  type RenewalRequest,
} from '@/lib/api/reports';
import {
  ClientListResponseSchema,
  EB_PRODUCTS,
  EB_PRODUCT_LABELS,
  RENEWAL_COUNT_METRICS,
  RENEWAL_METRICS,
  RENEWAL_METRIC_LABELS,
  RENEWAL_PERCENT_METRICS,
  RecordedPolicyYearSchema,
  SavedRenewalReportSchema,
  formatDate,
  formatDateTime,
  formatIndianNumber,
  type EbProduct,
  type RecordedPolicyYear,
  type RenewalAnalysis,
  type RenewalMetric,
} from '@/shared';

const MAX_YEARS = 3;

/** A figure as the report shows it: a count, an amount or a percentage. */
function figure(metric: RenewalMetric, value: string | null): string {
  if (value === null) return '—';
  if (RENEWAL_PERCENT_METRICS.includes(metric)) return `${value}%`;
  if (RENEWAL_COUNT_METRICS.includes(metric)) return formatIndianNumber(value, 0);
  return inr(value);
}
function change(metric: RenewalMetric, value: string | null): string {
  if (value === null) return '—';
  const sign = value.startsWith('-') ? '' : '+';
  if (RENEWAL_PERCENT_METRICS.includes(metric)) return `${sign}${value} pts`;
  if (RENEWAL_COUNT_METRICS.includes(metric)) return `${sign}${formatIndianNumber(value, 0)}`;
  return `${sign}${inr(value)}`;
}

/**
 * The benefit and cost analysis for a renewal (N8): up to three policy years of a company and
 * product side by side, with the change between years and the coming year's quotes. Years come
 * from policies placed in the app or are recorded by hand for years before it. All figures are
 * worked out by the API.
 */
export function RenewalAnalysisPanel() {
  const canEdit = usePermission('renewal_analysis.manage');
  const canExport = usePermission('renewal_analysis.export');
  const [clientId, setClientId] = useState('');
  const [product, setProduct] = useState<EbProduct>('GMC');
  const [chosen, setChosen] = useState<string[]>([]);
  const [upcomingCaseId, setUpcomingCaseId] = useState('');
  const [asOf, setAsOf] = useState('');
  const [editing, setEditing] = useState<RecordedPolicyYear | 'new' | null>(null);
  const [savedId, setSavedId] = useState('');
  const options = useQuery(renewalOptionsQuery(clientId, product));
  const years = options.data?.years ?? [];
  // Oldest first, as the report reads.
  const request: RenewalRequest | null =
    clientId && chosen.length > 0
      ? {
          clientId,
          product,
          years: years
            .filter((year) => chosen.includes(`${year.source}:${year.id}`))
            .sort((a, b) => a.policyStart.localeCompare(b.policyStart))
            .map((year) => ({ source: year.source, id: year.id })),
          upcomingCaseId: upcomingCaseId || null,
          ...(asOf ? { asOf } : {}),
        }
      : null;
  const analysis = useQuery(renewalAnalysisQuery(request));
  const reset = () => {
    setChosen([]);
    setUpcomingCaseId('');
    setSavedId('');
  };

  return (
    <div className="grid gap-6">
      <Card>
        <CardContent className="grid gap-4 pt-6">
          <div className="flex flex-wrap items-end gap-3">
            <CompanyPicker
              value={clientId}
              onChange={(value) => {
                setClientId(value);
                reset();
              }}
            />
            <Label className="grid gap-1 text-sm font-normal">
              Product
              <NativeSelect
                className="w-56"
                value={product}
                onChange={(event) => {
                  setProduct(event.target.value as EbProduct);
                  reset();
                }}
              >
                {EB_PRODUCTS.map((value) => (
                  <option key={value} value={value}>
                    {EB_PRODUCT_LABELS[value]}
                  </option>
                ))}
              </NativeSelect>
            </Label>
            <Label className="grid gap-1 text-sm font-normal">
              Claims counted to
              <Input
                type="date"
                className="w-40"
                value={asOf}
                onChange={(event) => setAsOf(event.target.value)}
              />
            </Label>
          </div>
          {clientId ? (
            options.isError ? (
              <ErrorState error={options.error} onRetry={() => void options.refetch()} />
            ) : (
              <>
                <fieldset className="grid gap-2">
                  <legend className="mb-1 text-sm font-semibold">
                    Policy years (at most {MAX_YEARS})
                  </legend>
                  {years.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No placed policy or recorded year for this company and product yet.
                    </p>
                  ) : (
                    years.map((year) => {
                      const key = `${year.source}:${year.id}`;
                      const checked = chosen.includes(key);
                      return (
                        <Label key={key} className="flex items-center gap-2 text-sm font-normal">
                          <Checkbox
                            checked={checked}
                            disabled={!checked && chosen.length >= MAX_YEARS}
                            onCheckedChange={(next) =>
                              setChosen((current) =>
                                next === true
                                  ? [...current, key]
                                  : current.filter((item) => item !== key),
                              )
                            }
                          />
                          {year.label}
                        </Label>
                      );
                    })
                  )}
                </fieldset>
                <div className="flex flex-wrap items-end gap-3">
                  <Label className="grid gap-1 text-sm font-normal">
                    Coming year’s quotes from
                    <NativeSelect
                      className="w-80"
                      value={upcomingCaseId}
                      onChange={(event) => setUpcomingCaseId(event.target.value)}
                    >
                      <option value="">No quote comparison</option>
                      {(options.data?.upcoming ?? []).map((item) => (
                        <option key={item.caseId} value={item.caseId}>
                          {item.reference} ({item.quotes} final quote(s))
                        </option>
                      ))}
                    </NativeSelect>
                  </Label>
                  {canEdit ? (
                    <Button variant="outline" onClick={() => setEditing('new')}>
                      <Plus aria-hidden="true" />
                      Record a past year
                    </Button>
                  ) : null}
                </div>
              </>
            )
          ) : null}
        </CardContent>
      </Card>
      {clientId ? (
        <RecordedYears clientId={clientId} product={product} onEdit={setEditing} />
      ) : null}
      {!request ? (
        <EmptyState
          title="Choose a company and its policy years"
          description="The analysis compares up to three years side by side."
        />
      ) : analysis.isError ? (
        <ErrorState error={analysis.error} onRetry={() => void analysis.refetch()} />
      ) : !analysis.data ? (
        <LoadingState label="Working out the analysis" />
      ) : (
        <>
          <AnalysisView data={analysis.data} />
          {canExport ? (
            <ReportActions request={request} canSave={canEdit} onSaved={setSavedId} />
          ) : null}
        </>
      )}
      {clientId ? <SavedReports clientId={clientId} openId={savedId} onOpen={setSavedId} /> : null}
      {editing ? (
        <YearDialog
          clientId={clientId}
          product={product}
          year={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}

function CompanyPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const clients = useQuery({
    queryKey: ['clients', 'list', '', 'renewal'],
    queryFn: ({ signal }) =>
      apiFetch('clients?limit=100', { schema: ClientListResponseSchema, signal }),
  });
  return (
    <Label className="grid gap-1 text-sm font-normal">
      Company
      <NativeSelect
        className="w-72"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Choose a company</option>
        {(clients.data?.items ?? []).map((client) => (
          <option key={client.id} value={client.id}>
            {client.name}
          </option>
        ))}
      </NativeSelect>
    </Label>
  );
}

/** The years side by side, each metric with its change from the year before. */
function AnalysisView({ data }: { data: RenewalAnalysis }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {data.company} · {EB_PRODUCT_LABELS[data.product]}
        </CardTitle>
        <CardDescription>
          Claims counted to {formatDate(data.asOf)}. Worked out {formatDateTime(data.generatedAt)}.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {data.warnings.length > 0 ? (
          <Alert>
            <AlertTitle>Read with care</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-5">
                {data.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : null}
        <div
          role="region"
          aria-label="Benefit and cost analysis"
          tabIndex={0}
          className="overflow-x-auto rounded-md border"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead />
                {data.years.map((year, index) => (
                  <Fragment key={year.sourceId}>
                    {index > 0 ? (
                      <TableHead key={`${year.sourceId}-change`} className="text-right">
                        Change
                      </TableHead>
                    ) : null}
                    <TableHead key={year.sourceId} className="text-right">
                      {year.label}
                      <span className="block text-xs font-normal text-muted-foreground">
                        {year.insurerName ?? ''}
                        {year.source === 'RECORDED' ? ' · recorded' : ''}
                        {year.incomplete ? ' · incomplete' : ''}
                      </span>
                    </TableHead>
                  </Fragment>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {RENEWAL_METRICS.map((metric) => (
                <TableRow key={metric}>
                  <TableCell className="font-medium">{RENEWAL_METRIC_LABELS[metric]}</TableCell>
                  {data.years.map((year, index) => {
                    const step =
                      index > 0
                        ? data.changes[index - 1]?.find((item) => item.metric === metric)
                        : null;
                    return (
                      <Fragment key={year.sourceId}>
                        {index > 0 ? (
                          <TableCell
                            key={`${year.sourceId}-change`}
                            className="text-right text-xs tabular text-muted-foreground"
                            title={step?.reason ?? undefined}
                          >
                            {step ? change(metric, step.absolute) : '—'}
                            {step?.percent ? (
                              <span className="block">
                                {step.percent.startsWith('-') ? '' : '+'}
                                {step.percent}%
                              </span>
                            ) : null}
                          </TableCell>
                        ) : null}
                        <TableCell key={year.sourceId} className="text-right tabular">
                          {year[metric].value === null ? (
                            <span className="text-xs text-muted-foreground">
                              {year[metric].reason}
                            </span>
                          ) : (
                            figure(metric, year[metric].value)
                          )}
                        </TableCell>
                      </Fragment>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <SumInsuredTable data={data} />
        {data.years.some((year) => year.notes.length > 0) ? (
          <ul className="list-disc pl-5 text-xs text-muted-foreground">
            {data.years.flatMap((year) =>
              year.notes.map((note) => (
                <li key={`${year.sourceId}-${note}`}>
                  {year.label}: {note}
                </li>
              )),
            )}
          </ul>
        ) : null}
        {data.upcoming ? (
          <section className="grid gap-2">
            <h3 className="text-sm font-semibold">
              Coming year’s quotes ({data.upcoming.reference})
            </h3>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Insurer</TableHead>
                    <TableHead className="text-right">Premium before GST</TableHead>
                    <TableHead className="text-right">GST</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Against the latest year</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.upcoming.quotes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-muted-foreground">
                        No final quote recorded yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.upcoming.quotes.map((quote) => (
                      <TableRow key={`${quote.insurerName}-${quote.quoteVersion}`}>
                        <TableCell>
                          {quote.insurerName}{' '}
                          {quote.lowest ? <Badge variant="success">Lowest</Badge> : null}
                        </TableCell>
                        <TableCell className="text-right tabular">
                          {inr(quote.basePremium)}
                        </TableCell>
                        <TableCell className="text-right tabular">{inr(quote.gst)}</TableCell>
                        <TableCell className="text-right tabular">
                          {inr(quote.totalPremium)}
                        </TableCell>
                        <TableCell className="text-right tabular">
                          {quote.changePercent === null
                            ? '—'
                            : `${quote.changePercent.startsWith('-') ? '' : '+'}${quote.changePercent}%`}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </section>
        ) : null}
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">How the figures are worked out</summary>
          <dl className="mt-2 grid gap-1">
            {data.parameters.map((item) => (
              <div key={item.label}>
                <dt className="inline font-medium">{item.label}: </dt>
                <dd className="inline">{item.value}</dd>
              </div>
            ))}
          </dl>
        </details>
      </CardContent>
    </Card>
  );
}

function SumInsuredTable({ data }: { data: RenewalAnalysis }) {
  const amounts = [
    ...new Set(data.years.flatMap((year) => (year.bySumInsured ?? []).map((row) => row.amount))),
  ].sort((a, b) => Number(a) - Number(b));
  if (amounts.length === 0) return null;
  return (
    <section className="grid gap-2">
      <h3 className="text-sm font-semibold">By sum insured (families / lives)</h3>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sum insured</TableHead>
              {data.years.map((year) => (
                <TableHead key={year.sourceId} className="text-right">
                  {year.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {amounts.map((amount) => (
              <TableRow key={amount}>
                <TableCell>{inr(amount)}</TableCell>
                {data.years.map((year) => {
                  const row = year.bySumInsured?.find((item) => item.amount === amount);
                  return (
                    <TableCell key={year.sourceId} className="text-right tabular">
                      {year.bySumInsured === null
                        ? 'Not recorded'
                        : row
                          ? `${row.families} / ${row.lives}`
                          : '0 / 0'}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

function ReportActions({
  request,
  canSave,
  onSaved,
}: {
  request: RenewalRequest;
  canSave: boolean;
  onSaved: (id: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const save = useReportMutation(
    () =>
      apiFetch('renewal/reports', {
        method: 'POST',
        body: { ...request, title },
        schema: SavedRenewalReportSchema,
      }),
    (result) => {
      onSaved(result.id);
      setTitle('');
      return { title: 'Report saved', description: 'Its figures stay as they are now.' };
    },
  );
  const download = (format: 'xlsx' | 'pdf') => {
    setBusy(true);
    setError(null);
    apiDownload(`renewal/analysis/document?format=${format}`, `Renewal-analysis.${format}`, {
      body: request,
    })
      .then(saveFile)
      .catch(setError)
      .finally(() => setBusy(false));
  };
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-end gap-2">
        <Button variant="outline" disabled={busy} onClick={() => download('xlsx')}>
          <Download aria-hidden="true" />
          Excel
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => download('pdf')}>
          <Download aria-hidden="true" />
          PDF
        </Button>
        {canSave ? (
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate(undefined);
            }}
          >
            <Label className="grid gap-1 text-sm font-normal">
              Save as
              <Input
                className="w-64"
                value={title}
                placeholder="Renewal 2026 analysis"
                onChange={(event) => setTitle(event.target.value)}
              />
            </Label>
            <Button type="submit" disabled={!title.trim() || save.isPending}>
              <Save aria-hidden="true" />
              Save the report
            </Button>
          </form>
        ) : null}
      </div>
      {error || save.error ? (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage(error ?? save.error)}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

function SavedReports({
  clientId,
  openId,
  onOpen,
}: {
  clientId: string;
  openId: string;
  onOpen: (id: string) => void;
}) {
  const list = useQuery(savedReportsQuery(clientId));
  const report = useQuery(savedReportQuery(openId));
  const canExport = usePermission('renewal_analysis.export');
  const [error, setError] = useState<unknown>(null);
  const items = list.data?.items ?? [];
  if (items.length === 0 && !list.isError) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Saved reports</CardTitle>
        <CardDescription>
          Each keeps its figures as they were when saved, whatever changes afterwards.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {list.isError ? (
          <ErrorState error={list.error} onRetry={() => void list.refetch()} />
        ) : (
          <ul className="grid gap-2">
            {items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-2 text-sm">
                <button
                  type="button"
                  className="rounded-sm font-medium text-accent-strong underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => onOpen(item.id)}
                >
                  {item.title}
                </button>
                <span className="text-muted-foreground">
                  {EB_PRODUCT_LABELS[item.product]} · {item.years.join(', ')} · saved{' '}
                  {formatDateTime(item.createdAt)} by {item.createdBy}
                </span>
                {canExport
                  ? (['xlsx', 'pdf'] as const).map((format) => (
                      <Button
                        key={format}
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setError(null);
                          apiDownload(
                            `renewal/reports/${item.id}/document?format=${format}`,
                            `${item.title}.${format}`,
                          )
                            .then(saveFile)
                            .catch(setError);
                        }}
                      >
                        <Download aria-hidden="true" />
                        {format === 'xlsx' ? 'Excel' : 'PDF'}
                      </Button>
                    ))
                  : null}
              </li>
            ))}
          </ul>
        )}
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage(error)}</AlertDescription>
          </Alert>
        ) : null}
        {openId && report.data ? <AnalysisView data={report.data.analysis} /> : null}
      </CardContent>
    </Card>
  );
}

function RecordedYears({
  clientId,
  product,
  onEdit,
}: {
  clientId: string;
  product: EbProduct;
  onEdit: (year: RecordedPolicyYear) => void;
}) {
  const canEdit = usePermission('renewal_analysis.manage');
  const list = useQuery(recordedYearsQuery(clientId, product));
  const items = list.data?.items ?? [];
  if (items.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Years recorded by hand</CardTitle>
        <CardDescription>
          Years before the app or placed elsewhere, from the documents named as their source.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Insurer</TableHead>
                <TableHead className="text-right">Employees</TableHead>
                <TableHead className="text-right">Lives</TableHead>
                <TableHead className="text-right">Premium before GST</TableHead>
                <TableHead>Source</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((year) => (
                <TableRow key={year.id}>
                  <TableCell className="tabular">
                    {formatDate(year.policyStart)} to {formatDate(year.policyEnd)}
                  </TableCell>
                  <TableCell>{year.insurerName}</TableCell>
                  <TableCell className="text-right tabular">{year.employees ?? '—'}</TableCell>
                  <TableCell className="text-right tabular">{year.lives ?? '—'}</TableCell>
                  <TableCell className="text-right tabular">{inr(year.premiumBeforeGst)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{year.source}</TableCell>
                  <TableCell>
                    {canEdit ? (
                      <Button variant="ghost" size="sm" onClick={() => onEdit(year)}>
                        <Pencil aria-hidden="true" />
                        Edit
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

const TEXT_FIELDS = [
  ['insurerName', 'Insurer'],
  ['policyNumber', 'Policy number'],
  ['totalSumInsured', 'Total sum insured (₹)'],
  ['premiumBeforeGst', 'Premium before GST (₹)'],
  ['gst', 'GST (₹)'],
  ['claimsPaid', 'Claims paid (₹)'],
  ['claimsOutstanding', 'Claims outstanding (₹)'],
] as const;
const COUNT_FIELDS = [
  ['employees', 'Employees (families)'],
  ['lives', 'Insured lives'],
  ['claimsCount', 'Number of claims'],
] as const;

function YearDialog({
  clientId,
  product,
  year,
  onClose,
}: {
  clientId: string;
  product: EbProduct;
  year: RecordedPolicyYear | null;
  onClose: () => void;
}) {
  const text = (value: string | null | undefined) => value ?? '';
  const [draft, setDraft] = useState<Record<string, string>>({
    policyStart: text(year?.policyStart),
    policyEnd: text(year?.policyEnd),
    insurerName: text(year?.insurerName),
    policyNumber: text(year?.policyNumber),
    totalSumInsured: text(year?.totalSumInsured),
    premiumBeforeGst: text(year?.premiumBeforeGst),
    gst: text(year?.gst),
    claimsPaid: text(year?.claimsPaid),
    claimsOutstanding: text(year?.claimsOutstanding),
    claimsAsOf: text(year?.claimsAsOf),
    employees: year?.employees === null || year === null ? '' : String(year.employees),
    lives: year?.lives === null || year === null ? '' : String(year.lives),
    claimsCount: year?.claimsCount === null || year === null ? '' : String(year.claimsCount),
    source: text(year?.source),
  });
  const orNull = (value: string) => (value.trim() ? value.trim() : null);
  const count = (value: string) => (value.trim() ? Number(value) : null);
  const save = useReportMutation(
    () =>
      apiFetch(year ? `renewal/years/${year.id}` : 'renewal/years', {
        method: year ? 'PUT' : 'POST',
        body: {
          clientId,
          product,
          policyStart: draft.policyStart,
          policyEnd: draft.policyEnd,
          insurerName: draft.insurerName,
          policyNumber: orNull(draft.policyNumber!),
          employees: count(draft.employees!),
          lives: count(draft.lives!),
          totalSumInsured: orNull(draft.totalSumInsured!),
          bySumInsured: year?.bySumInsured ?? null,
          premiumBeforeGst: orNull(draft.premiumBeforeGst!),
          gst: orNull(draft.gst!),
          claimsPaid: orNull(draft.claimsPaid!),
          claimsOutstanding: orNull(draft.claimsOutstanding!),
          claimsCount: count(draft.claimsCount!),
          claimsAsOf: orNull(draft.claimsAsOf!),
          source: draft.source,
        },
        schema: RecordedPolicyYearSchema,
      }),
    () => ({ title: year ? 'Policy year saved' : 'Policy year recorded' }),
  );
  const field = (key: string, label: string, type = 'text') => (
    <Label key={key} className="grid gap-1 text-sm font-normal">
      {label}
      <Input
        type={type}
        value={draft[key]}
        inputMode={
          type === 'text' && key !== 'insurerName' && key !== 'policyNumber' ? 'decimal' : undefined
        }
        onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
      />
    </Label>
  );
  const problem = issuesText(save.error);
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{year ? 'Edit a recorded year' : 'Record a past policy year'}</DialogTitle>
          <DialogDescription>
            Leave a figure empty when it is not known: the report says so instead of guessing.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate(undefined, { onSuccess: onClose });
          }}
        >
          {field('policyStart', 'Policy start', 'date')}
          {field('policyEnd', 'Policy end', 'date')}
          {TEXT_FIELDS.map(([key, label]) => field(key, label))}
          {COUNT_FIELDS.map(([key, label]) => field(key, label, 'number'))}
          {field('claimsAsOf', 'Claims figures as of', 'date')}
          <div className="sm:col-span-2">{field('source', 'Source of the figures')}</div>
          {save.error ? (
            <Alert variant="destructive" className="sm:col-span-2">
              <AlertTitle>{errorMessage(save.error)}</AlertTitle>
              {problem ? <AlertDescription>{problem}</AlertDescription> : null}
            </Alert>
          ) : null}
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
