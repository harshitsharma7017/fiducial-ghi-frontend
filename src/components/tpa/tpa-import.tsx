'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Download, FileUp, LoaderCircle, Trash2, Upload } from 'lucide-react';
import { useState } from 'react';
import { Pager } from '@/components/ghi/ghi-ui';
import { EmptyState, ErrorState, TableLoadingRows, errorMessage } from '@/components/states';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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
  tpaFormatsQuery,
  tpaImportQuery,
  tpaImportRowsQuery,
  tpaImportsQuery,
  uploadTpaFile,
  useTpaMutation,
} from '@/lib/api/tpa';
import {
  TPA_FIELD_INFO,
  TpaImportSchema,
  formatDateTime,
  type TpaImport,
  type TpaImportPolicy,
} from '@/shared';
import { PolicyPicker, Stat } from './tpa-ui';

const ACTION_VARIANT = {
  CREATE: 'success',
  UPDATE: 'info',
  UNCHANGED: 'muted',
  INVALID: 'destructive',
} as const;
const ACTION_LABEL = {
  CREATE: 'New',
  UPDATE: 'Changed',
  UNCHANGED: 'Unchanged',
  INVALID: 'Not imported',
} as const;
const STATUS_LABEL: Record<TpaImport['status'], string> = {
  VALIDATED: 'Checked, not imported',
  IMPORTING: 'Importing',
  IMPORTED: 'Imported',
  DISCARDED: 'Discarded',
  FAILED: 'Failed',
};

/**
 * Imports a TPA's claims file for a placed policy (N9): choose the policy and the TPA format,
 * upload, read the preview and the problems, then import all rows or the valid rows only. The
 * file is checked row by row first; nothing is saved until the import is confirmed.
 */
export function TpaImportPanel() {
  const [caseId, setCaseId] = useState('');
  const [formatId, setFormatId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [openId, setOpenId] = useState('');
  const formats = useQuery(tpaFormatsQuery());
  const active = (formats.data?.items ?? []).filter((format) => format.active);
  const upload = useTpaMutation(
    () => uploadTpaFile(caseId, formatId, file!),
    (result) => {
      setOpenId(result.id);
      setFile(null);
      return {
        title: 'File checked',
        description: `${result.counts.rows} rows read: ${result.counts.valid} can be imported, ${result.counts.invalid} cannot.`,
      };
    },
  );

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload a TPA claims file</CardTitle>
          <CardDescription>
            The file is checked against the format first. Nothing is imported until you confirm.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              upload.mutate(undefined);
            }}
          >
            <PolicyPicker
              value={caseId}
              onChange={(value) => {
                setCaseId(value);
                setOpenId('');
              }}
            />
            <Label className="grid gap-1 text-sm font-normal">
              TPA format
              <NativeSelect
                className="w-[min(36rem,100%)]"
                value={formatId}
                onChange={(event) => setFormatId(event.target.value)}
              >
                <option value="">
                  {active.length === 0 && !formats.isPending
                    ? 'No active format: an Admin sets one up'
                    : 'Choose the TPA’s format'}
                </option>
                {active.map((format) => (
                  <option key={format.id} value={format.id}>
                    {format.name} ({format.tpaCode})
                  </option>
                ))}
              </NativeSelect>
            </Label>
            <Label className="grid gap-1 text-sm font-normal">
              Excel file (.xlsx, at most 25 MB)
              <Input
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="w-[min(36rem,100%)]"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </Label>
            {upload.error ? (
              <Alert variant="destructive">
                <AlertTitle>The file was not accepted</AlertTitle>
                <AlertDescription>
                  {errorMessage(upload.error)}
                  <FileIssues error={upload.error} />
                </AlertDescription>
              </Alert>
            ) : null}
            <div>
              <Button type="submit" disabled={!caseId || !formatId || !file || upload.isPending}>
                {upload.isPending ? (
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                ) : (
                  <Upload aria-hidden="true" />
                )}
                Check the file
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      {openId ? <ImportReview importId={openId} onClose={() => setOpenId('')} /> : null}
      {caseId ? <ImportHistory caseId={caseId} onOpen={setOpenId} openId={openId} /> : null}
    </div>
  );
}

function FileIssues({ error }: { error: unknown }) {
  const issues = (error as { details?: { issues?: unknown } } | null)?.details?.issues;
  if (!Array.isArray(issues) || issues.length === 0) return null;
  return (
    <ul className="mt-2 list-disc pl-5">
      {issues.map((issue) => (
        <li key={String(issue)}>{String(issue)}</li>
      ))}
    </ul>
  );
}

/** An import's counts, its rows and problems, and the import or discard buttons. */
function ImportReview({ importId, onClose }: { importId: string; onClose: () => void }) {
  const canProcess = usePermission('claims.process');
  const record = useQuery(tpaImportQuery(importId));
  const [only, setOnly] = useState<'ALL' | 'ERRORS' | 'WARNINGS'>('ALL');
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState<TpaImportPolicy | null>(null);
  const rows = useQuery({
    ...tpaImportRowsQuery(importId, only, page),
    placeholderData: keepPreviousData,
  });
  const commit = useTpaMutation(
    (policy: TpaImportPolicy) =>
      apiFetch(`tpa/imports/${importId}/commit`, {
        method: 'POST',
        body: { policy },
        schema: TpaImportSchema,
      }),
    (result) => ({
      title: result.status === 'IMPORTED' ? 'Claims imported' : 'The import did not finish',
      description: result.result
        ? `${result.result.created} new, ${result.result.updated} changed, ${result.result.unchanged} unchanged, ${result.result.failed} failed.`
        : undefined,
    }),
  );
  const discard = useTpaMutation(
    () => apiFetch(`tpa/imports/${importId}/discard`, { method: 'POST', schema: TpaImportSchema }),
    () => ({ title: 'Import discarded' }),
  );
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<unknown>(null);

  if (record.isError)
    return <ErrorState error={record.error} onRetry={() => void record.refetch()} />;
  if (record.isPending) return null;
  const data = record.data;
  const pages = rows.data ? Math.max(1, Math.ceil(rows.data.total / rows.data.limit)) : 1;
  const hasProblems = data.counts.invalid > 0 || data.counts.warnings > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {data.fileName} <Badge variant="outline">{STATUS_LABEL[data.status]}</Badge>
        </CardTitle>
        <CardDescription>
          {data.formatName} ({data.tpaCode}, format revision {data.formatRevision}) · policy{' '}
          {data.caseReference} · checked {formatDateTime(data.uploadedAt)} by {data.uploadedBy}
          {data.importedAt
            ? ` · imported ${formatDateTime(data.importedAt)} by ${data.importedBy ?? ''}`
            : ''}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          <Stat label="Rows" value={data.counts.rows} />
          <Stat label="Can be imported" value={data.counts.valid} tone="success" />
          <Stat
            label="With errors"
            value={data.counts.invalid}
            tone={data.counts.invalid ? 'destructive' : undefined}
          />
          <Stat
            label="With warnings"
            value={data.counts.warnings}
            tone={data.counts.warnings ? 'warning' : undefined}
          />
          <Stat label="New claims" value={data.counts.create} />
          <Stat label="Changed claims" value={data.counts.update} />
          <Stat label="Unchanged" value={data.counts.unchanged} />
        </div>
        {data.fileIssues.length > 0 ? (
          <Alert>
            <AlertTitle>About the file</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-5">
                {data.fileIssues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : null}
        {data.result ? <ImportResult data={data} /> : null}
        <div className="flex flex-wrap items-end gap-3">
          <Label className="grid gap-1 text-sm font-normal">
            Show
            <NativeSelect
              className="w-48"
              value={only}
              onChange={(event) => {
                setOnly(event.target.value as typeof only);
                setPage(1);
              }}
            >
              <option value="ALL">Every row</option>
              <option value="ERRORS">Rows with errors</option>
              <option value="WARNINGS">Rows with warnings</option>
            </NativeSelect>
          </Label>
          {hasProblems ? (
            <Button
              variant="outline"
              disabled={downloading}
              onClick={() => {
                setDownloading(true);
                setDownloadError(null);
                apiDownload(`tpa/imports/${importId}/error-report`, 'TPA-import-problems.xlsx')
                  .then(saveFile)
                  .catch(setDownloadError)
                  .finally(() => setDownloading(false));
              }}
            >
              <Download aria-hidden="true" />
              Download the problems
            </Button>
          ) : null}
        </div>
        {downloadError ? (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage(downloadError)}</AlertDescription>
          </Alert>
        ) : null}
        {rows.isError ? (
          <ErrorState error={rows.error} onRetry={() => void rows.refetch()} />
        ) : (
          <div
            role="region"
            aria-label="Rows of the file"
            tabIndex={0}
            className="overflow-x-auto rounded-md border"
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Row</TableHead>
                  <TableHead>TPA claim ID</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Admitted</TableHead>
                  <TableHead className="text-right">Claimed</TableHead>
                  <TableHead>Problems</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.isPending ? (
                  <TableLoadingRows columns={8} />
                ) : rows.data.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <EmptyState title="No rows" description="No row matches this choice." />
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.data.items.map((row) => (
                    <TableRow key={row.row}>
                      <TableCell className="tabular">{row.row}</TableCell>
                      <TableCell className="font-medium">{row.tpaClaimId ?? '—'}</TableCell>
                      <TableCell>
                        <Badge variant={ACTION_VARIANT[row.action]}>
                          {ACTION_LABEL[row.action]}
                        </Badge>
                      </TableCell>
                      <TableCell>{row.values.sourceStatus ?? row.values.status ?? '—'}</TableCell>
                      <TableCell>
                        {row.values.employeeId ?? '—'}
                        {row.values.memberName ? (
                          <span className="block text-xs text-muted-foreground">
                            {row.values.memberName}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="tabular">{row.values.admissionDate ?? '—'}</TableCell>
                      <TableCell className="text-right tabular">
                        {row.values.claimedAmount ?? '—'}
                      </TableCell>
                      <TableCell className="min-w-64">
                        {row.issues.length === 0 ? (
                          '—'
                        ) : (
                          <ul className="grid gap-1">
                            {row.issues.map((issue, index) => (
                              <li
                                key={index}
                                className={
                                  issue.severity === 'ERROR' ? 'text-destructive' : 'text-warning'
                                }
                              >
                                {issue.field ? `${TPA_FIELD_INFO[issue.field].label}: ` : ''}
                                {issue.message}
                              </li>
                            ))}
                          </ul>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
        <Pager page={page} pages={pages} total={rows.data?.total ?? 0} onPage={setPage} />
        {data.status === 'VALIDATED' && canProcess ? (
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={data.counts.invalid > 0 || data.counts.valid === 0 || commit.isPending}
              onClick={() => setConfirm('ALL_VALID')}
            >
              <FileUp aria-hidden="true" />
              Import all rows
            </Button>
            {data.counts.invalid > 0 && data.counts.valid > 0 ? (
              <Button
                variant="outline"
                disabled={commit.isPending}
                onClick={() => setConfirm('VALID_ONLY')}
              >
                Import the {data.counts.valid} valid rows only
              </Button>
            ) : null}
            <Button
              variant="ghost"
              disabled={discard.isPending}
              onClick={() => discard.mutate(undefined, { onSuccess: onClose })}
            >
              <Trash2 aria-hidden="true" />
              Discard
            </Button>
          </div>
        ) : null}
        {commit.error || discard.error ? (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage(commit.error ?? discard.error)}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
      <Dialog
        open={confirm !== null}
        onOpenChange={(open) => (open ? undefined : setConfirm(null))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import the claims?</DialogTitle>
            <DialogDescription>
              {confirm === 'VALID_ONLY'
                ? `${data.counts.valid} rows are imported; ${data.counts.invalid} rows with errors are left out (download the problems to correct them).`
                : `${data.counts.valid} rows are imported.`}{' '}
              New claims are added, changed claims updated and their history kept. Claims on the
              board move only forward, to the column the format maps; whether the claimant and HR
              are emailed follows the import email settings (off until the client approves).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              disabled={commit.isPending}
              onClick={() =>
                commit.mutate(confirm!, {
                  onSettled: () => setConfirm(null),
                })
              }
            >
              {commit.isPending ? (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              ) : null}
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/** What the import did, to the TPA records and to the claims board (N11). */
function ImportResult({ data }: { data: TpaImport }) {
  const result = data.result!;
  return (
    <div className="grid gap-3 rounded-md border bg-muted/30 p-3">
      <h3 className="text-sm font-semibold">Imported</h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Stat label="New" value={result.created} tone="success" />
        <Stat label="Changed" value={result.updated} />
        <Stat label="Unchanged" value={result.unchanged} />
        <Stat label="Left out (errors)" value={result.skipped} />
        <Stat
          label="Failed"
          value={result.failed}
          tone={result.failed ? 'destructive' : undefined}
        />
      </div>
      {result.failures.length > 0 ? (
        <ul className="list-disc pl-5 text-sm text-destructive">
          {result.failures.map((failure) => (
            <li key={failure.row}>
              Row {failure.row}: {failure.message}
            </li>
          ))}
        </ul>
      ) : null}
      {result.board ? (
        <>
          <h3 className="text-sm font-semibold">Claims board</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
            <Stat label="Added" value={result.board.created} />
            <Stat label="Moved forward" value={result.board.moved} />
            <Stat label="Settlement recorded" value={result.board.settlementUpdated} />
            <Stat label="Unchanged" value={result.board.unchanged} />
            <Stat
              label="No board column"
              value={result.board.notMapped}
              tone={result.board.notMapped ? 'warning' : undefined}
            />
            <Stat
              label="For review"
              value={result.board.review}
              tone={result.board.review ? 'warning' : undefined}
            />
            <Stat
              label="Failed"
              value={result.board.failed}
              tone={result.board.failed ? 'destructive' : undefined}
            />
            <Stat label="Emails queued" value={result.board.emailsQueued} />
          </div>
        </>
      ) : null}
      {result.unmappedBoardStatuses && result.unmappedBoardStatuses.length > 0 ? (
        <Alert>
          <AlertTitle>TPA statuses with no board column</AlertTitle>
          <AlertDescription>
            These claims were not put on the board. An Admin maps each status in the TPA format:{' '}
            {result.unmappedBoardStatuses
              .map((item) => `"${item.source}" (${item.rows})`)
              .join(', ')}
            .
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

function ImportHistory({
  caseId,
  openId,
  onOpen,
}: {
  caseId: string;
  openId: string;
  onOpen: (id: string) => void;
}) {
  const imports = useQuery(tpaImportsQuery(caseId));
  if (imports.isError)
    return <ErrorState error={imports.error} onRetry={() => void imports.refetch()} />;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Files of this policy</CardTitle>
        <CardDescription>Every file checked or imported, latest first.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead>Format</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Rows</TableHead>
                <TableHead>Checked</TableHead>
                <TableHead>Imported</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {imports.isPending ? (
                <TableLoadingRows columns={7} rows={3} />
              ) : imports.data.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <EmptyState title="No files yet" description="Upload the TPA’s first file." />
                  </TableCell>
                </TableRow>
              ) : (
                imports.data.items.map((item) => (
                  <TableRow key={item.id} aria-current={item.id === openId ? 'true' : undefined}>
                    <TableCell className="font-medium">{item.fileName}</TableCell>
                    <TableCell>{item.formatName}</TableCell>
                    <TableCell>{STATUS_LABEL[item.status]}</TableCell>
                    <TableCell className="text-right tabular">{item.counts.rows}</TableCell>
                    <TableCell className="tabular">
                      {formatDateTime(item.uploadedAt)}
                      <span className="block text-xs text-muted-foreground">{item.uploadedBy}</span>
                    </TableCell>
                    <TableCell className="tabular">
                      {item.importedAt ? formatDateTime(item.importedAt) : '—'}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => onOpen(item.id)}>
                        Open
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
