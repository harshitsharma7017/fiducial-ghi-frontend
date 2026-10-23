'use client';

import { SelectionSummaryCard } from '@/components/eb/selection-summary-card';
import { useQuery } from '@tanstack/react-query';
import { CircleAlert, Eye, FilePlus2, LoaderCircle, Send } from 'lucide-react';
import { useState } from 'react';
import { ErrorState, LoadingState, errorMessage } from '@/components/states';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { usePermission } from '@/hooks/use-permission';
import { apiFetch } from '@/lib/api-client';
import {
  caseApi,
  ghiRfqPreviewQuery,
  ghiRfqQuery,
  issuesText,
  useGhiMutation,
  type WorkflowCase,
} from '@/lib/api/ghi';
import {
  GHI_RFQ_STATUS_LABELS,
  GhiRfqStateSchema,
  formatDateTime,
  type GhiDocumentPreview,
  type GhiRfqState,
  type GhiRfqVersion,
} from '@/shared';
import { DownloadButton, rupees } from './ghi-ui';
import { DispatchLog, RfqInsurers } from './rfq-insurers';

const STATUS_VARIANT = {
  DRAFT: 'muted',
  SUBMITTED: 'warning',
  APPROVED: 'success',
  RETURNED: 'destructive',
} as const;

/**
 * The RFQ (G5; GPA and GTLI, Requirement 6): generated as versions from the Data Sheet and
 * census, approved, then sent. The same panel serves every product.
 */
export function RfqPanel({ record }: { record: WorkflowCase }) {
  const query = useQuery(ghiRfqQuery(record.id, record.product));
  if (query.isPending) return <LoadingState label="Loading the RFQ" />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const state = query.data;
  return (
    <div className="grid gap-6">
      <VersionCard record={record} state={state} />
      <SelectionSummaryCard caseId={record.id} product={record.product} versions={state.versions} />
      <RfqInsurers record={record} state={state} />
      <DispatchLog dispatches={state.dispatches} title="RFQ mails" />
    </div>
  );
}

function VersionCard({ record, state }: { record: WorkflowCase; state: GhiRfqState }) {
  const canEdit = usePermission('gmc.edit');
  const canApprove = usePermission('gmc.approve');
  const canExport = usePermission('gmc.export');
  const [comment, setComment] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const open = record.stage !== 'CLOSED';
  const act = (path: string, body?: unknown) =>
    apiFetch(`${caseApi(record.product, record.id)}/rfq/${path}`, {
      method: 'POST',
      body,
      schema: GhiRfqStateSchema,
    });
  const generate = useGhiMutation(
    record.id,
    () => act('generate'),
    (result) => ({
      title: `RFQ v${result.current?.version ?? ''} generated`,
      description: 'Submit it for approval next.',
    }),
  );
  const submit = useGhiMutation(
    record.id,
    () => act('submit'),
    () => ({ title: 'RFQ submitted for approval' }),
  );
  const decide = useGhiMutation(
    record.id,
    (decision: 'APPROVED' | 'RETURNED') => act('decision', { decision, comment }),
    (_result, decision) => ({ title: decision === 'APPROVED' ? 'RFQ approved' : 'RFQ returned' }),
  );
  const current = state.current;
  const error = generate.error ?? submit.error ?? decide.error;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <CardTitle className="flex flex-wrap items-center gap-2">
            Request for quotation
            {current ? (
              <Badge variant={STATUS_VARIANT[current.status]}>
                v{current.version} · {GHI_RFQ_STATUS_LABELS[current.status]}
              </Badge>
            ) : null}
          </CardTitle>
          <CardDescription>
            The {record.product === 'GMC' ? 'GHI' : record.product} data sheet
            {record.product === 'GMC' ? '' : ', the family plan'}, census summary, previous claims
            and the full member list as an annexure.
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => setPreviewing(true)}>
            <Eye aria-hidden="true" />
            Preview
          </Button>
          {current && canExport ? (
            <>
              <DownloadButton
                path={`${caseApi(record.product, record.id)}/rfq/document?format=xlsx`}
                fallbackName={`${record.product === 'GMC' ? 'GHI' : record.product}-RFQ.xlsx`}
              >
                Excel
              </DownloadButton>
              <DownloadButton
                path={`${caseApi(record.product, record.id)}/rfq/document?format=pdf`}
                fallbackName={`${record.product === 'GMC' ? 'GHI' : record.product}-RFQ.pdf`}
              >
                PDF
              </DownloadButton>
            </>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        {state.missing.length > 0 && !record.locked ? (
          <Alert variant="warning">
            <CircleAlert aria-hidden="true" />
            <AlertTitle>Needed before the RFQ</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-4">
                {state.missing.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : null}
        {current?.stale ? (
          <Alert variant="warning">
            <CircleAlert aria-hidden="true" />
            <AlertTitle>RFQ v{current.version} is out of date</AlertTitle>
            <AlertDescription>
              The Data Sheet or census changed after it was generated. Generate a new version.
            </AlertDescription>
          </Alert>
        ) : null}
        {current ? (
          <VersionFacts version={current} />
        ) : (
          <p className="text-sm text-muted-foreground">No RFQ generated yet.</p>
        )}
        {current?.decision ? (
          <p className="text-sm">
            {current.decision.status === 'APPROVED' ? 'Approved' : 'Returned'} by{' '}
            {current.decision.by}, {formatDateTime(current.decision.at)}
            {current.decision.comment ? `: ${current.decision.comment}` : ''}
          </p>
        ) : null}
        {open ? (
          <div className="flex flex-wrap items-end gap-2">
            {canEdit && !record.locked ? (
              <Button
                type="button"
                variant={current && !current.stale ? 'outline' : 'default'}
                disabled={generate.isPending || state.missing.length > 0}
                onClick={() => generate.mutate(undefined)}
              >
                {generate.isPending ? (
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                ) : (
                  <FilePlus2 aria-hidden="true" />
                )}
                {current ? 'Generate a new version' : 'Generate RFQ'}
              </Button>
            ) : null}
            {canEdit &&
            current &&
            !current.stale &&
            (current.status === 'DRAFT' || current.status === 'RETURNED') ? (
              <Button
                type="button"
                disabled={submit.isPending}
                onClick={() => submit.mutate(undefined)}
              >
                <Send aria-hidden="true" />
                Submit for approval
              </Button>
            ) : null}
          </div>
        ) : null}
        {open && canApprove && current?.status === 'SUBMITTED' && !current.stale ? (
          <div className="grid gap-2 rounded-md border p-3">
            <p className="text-sm font-medium">Approve RFQ v{current.version}</p>
            <Textarea
              rows={2}
              aria-label="Comment (required to return)"
              placeholder="Comment (required to return)"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={decide.isPending}
                onClick={() => decide.mutate('APPROVED')}
              >
                Approve
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={decide.isPending || !comment.trim()}
                onClick={() => decide.mutate('RETURNED')}
              >
                Return with comment
              </Button>
            </div>
          </div>
        ) : null}
        {error ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{issuesText(error) ?? errorMessage(error)}</AlertDescription>
          </Alert>
        ) : null}
        {state.versions.length > 1 ? <VersionHistory versions={state.versions} /> : null}
      </CardContent>
      {previewing ? <PreviewDialog record={record} onClose={() => setPreviewing(false)} /> : null}
    </Card>
  );
}

function VersionFacts({ version }: { version: GhiRfqVersion }) {
  return (
    <p className="text-sm text-muted-foreground tabular">
      Generated by {version.generatedBy}, {formatDateTime(version.generatedAt)} ·{' '}
      {version.census.employees} employees, {version.census.lives} lives, total sum insured{' '}
      {rupees(version.census.totalSumInsured)}
      {version.ageBands ? ` · age bands: ${version.ageBands.name}` : ''}
    </p>
  );
}

function VersionHistory({ versions }: { versions: GhiRfqVersion[] }) {
  return (
    <div
      role="region"
      aria-label="RFQ versions"
      tabIndex={0}
      className="overflow-x-auto rounded-md border"
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Version</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Generated</TableHead>
            <TableHead className="text-right">Lives</TableHead>
            <TableHead>Decision</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {versions.map((version) => (
            <TableRow key={version.id}>
              <TableCell>v{version.version}</TableCell>
              <TableCell>
                {GHI_RFQ_STATUS_LABELS[version.status]}
                {version.stale ? ' (out of date)' : ''}
              </TableCell>
              <TableCell className="tabular">
                {formatDateTime(version.generatedAt)} · {version.generatedBy}
              </TableCell>
              <TableCell className="text-right tabular">{version.census.lives}</TableCell>
              <TableCell>
                {version.decision
                  ? `${version.decision.by}${version.decision.comment ? `: ${version.decision.comment}` : ''}`
                  : '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function PreviewDialog({ record, onClose }: { record: WorkflowCase; onClose: () => void }) {
  const preview = useQuery(ghiRfqPreviewQuery(record.id, record.product));
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>RFQ preview</DialogTitle>
          <DialogDescription>
            As the RFQ would be generated now, from the saved Data Sheet and census.
          </DialogDescription>
        </DialogHeader>
        {preview.isPending ? (
          <LoadingState label="Building the preview" />
        ) : preview.isError ? (
          <ErrorState error={preview.error} onRetry={() => void preview.refetch()} />
        ) : (
          <DocumentPreview preview={preview.data} />
        )}
      </DialogContent>
    </Dialog>
  );
}

/** A generated document's sheets as tables, as the API builds them for the download. */
export function DocumentPreview({ preview }: { preview: GhiDocumentPreview }) {
  return (
    <div className="grid gap-6">
      {preview.sheets.map((sheet) => (
        <section key={sheet.name} className="grid gap-2" aria-label={sheet.name}>
          <h3 className="text-base font-medium">{sheet.name}</h3>
          <div
            role="region"
            aria-label={`${sheet.name} rows`}
            tabIndex={0}
            className="overflow-x-auto rounded-md border"
          >
            <table className="w-full text-xs">
              <tbody>
                {sheet.rows.map((row, index) => (
                  <tr key={index} className="border-b last:border-0">
                    {row.map((cell, column) => (
                      <td key={column} className="px-2 py-1 align-top whitespace-pre-wrap tabular">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sheet.truncated > 0 ? (
            <p className="text-xs text-muted-foreground">
              {sheet.truncated} more rows in the download.
            </p>
          ) : null}
        </section>
      ))}
    </div>
  );
}
