'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleAlert, CircleCheck, LoaderCircle, Pencil, Upload, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { DownloadButton } from '@/components/ghi/ghi-ui';
import { ErrorState, LoadingState, errorMessage } from '@/components/states';
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
import { NativeSelect } from '@/components/ui/native-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ApiError, apiFetch } from '@/lib/api-client';
import { caseApi, refreshGhiCase } from '@/lib/api/ghi';
import { ebImportQuery } from '@/lib/eb/api';
import {
  EB_CENSUS_FIELD_LABELS,
  EB_IMPORT_MODES,
  EB_IMPORT_MODE_LABELS,
  EbCensusImportSchema,
  EbCommitResultSchema,
  GHI_IMPORT_POLICIES,
  GHI_IMPORT_POLICY_LABELS,
  XLSX_CONTENT_TYPE,
  type EbCaseRecord,
  type EbCensusRowValues,
  type EbImportMode,
  type EbImportResult,
  type EbImportRow,
  type GhiImportPolicy,
} from '@/shared';
import { Field } from './eb-ui';

/**
 * The census import (Requirements 20 to 22): upload a file, see every row with its errors and
 * warnings under the chosen mode, correct rows or download the error report, then import under
 * a policy the user chooses (no default). The counts come from the API.
 */
export function EbCensusImport({ record }: { record: EbCaseRecord }) {
  const queryClient = useQueryClient();
  const base = caseApi(record.product, record.id);
  const input = useRef<HTMLInputElement>(null);
  const [importId, setImportId] = useState<string | null>(null);
  const [mode, setMode] = useState<EbImportMode>('ADD_NEW_ONLY');
  const [policy, setPolicy] = useState<GhiImportPolicy | null>(null);
  const [result, setResult] = useState<EbImportResult | null>(null);
  const [fileIssues, setFileIssues] = useState<string[]>([]);
  const [correcting, setCorrecting] = useState<EbImportRow | null>(null);
  const upload = useMutation({
    mutationFn: (file: File) =>
      apiFetch(`${base}/census/imports?fileName=${encodeURIComponent(file.name)}`, {
        method: 'POST',
        body: new Blob([file], { type: XLSX_CONTENT_TYPE }),
        schema: EbCensusImportSchema,
      }),
    onSuccess: (saved) => {
      setImportId(saved.id);
      setResult(null);
      setPolicy(null);
      setFileIssues([]);
    },
    onError: (error) => {
      const issues =
        (error instanceof ApiError
          ? (error.details as { issues?: string[] } | undefined)?.issues
          : undefined) ?? [];
      setFileIssues(issues.length > 0 ? issues : [errorMessage(error)]);
    },
  });
  const preview = useQuery({
    ...ebImportQuery(record.product, record.id, importId ?? '', mode),
    enabled: Boolean(importId),
  });
  const commit = useMutation({
    mutationFn: () =>
      apiFetch(`${base}/census/imports/${importId}/commit`, {
        method: 'POST',
        body: { policy, mode },
        schema: EbCommitResultSchema,
      }),
    onSuccess: (outcome) => {
      setResult(outcome.result);
      refreshGhiCase(queryClient, record.id);
    },
  });
  const discard = useMutation({
    mutationFn: () =>
      apiFetch(`${base}/census/imports/${importId}/discard`, {
        method: 'POST',
        schema: EbCensusImportSchema,
      }),
    onSuccess: () => {
      setImportId(null);
      refreshGhiCase(queryClient, record.id);
    },
  });
  const data = preview.data;
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <CardTitle>Import the census</CardTitle>
          <CardDescription>
            Every row is checked first; nothing joins the census until you import. Up to 10,000
            rows, 10 MB.
          </CardDescription>
        </div>
        <div>
          <input
            ref={input}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            aria-label="Census file"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) upload.mutate(file);
              event.target.value = '';
            }}
          />
          <Button type="button" disabled={upload.isPending} onClick={() => input.current?.click()}>
            {upload.isPending ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : (
              <Upload aria-hidden="true" />
            )}
            Upload census file
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        {fileIssues.length > 0 ? (
          <Alert variant="destructive" role="alert">
            <AlertTitle>The file was not read</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-4">
                {fileIssues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : null}
        {result ? <ResultSummary result={result} /> : null}
        {importId && !result ? (
          preview.isPending ? (
            <LoadingState label="Checking the file" />
          ) : preview.isError ? (
            <ErrorState error={preview.error} onRetry={() => void preview.refetch()} />
          ) : data ? (
            <>
              {data.fileWarnings.map((warning) => (
                <Alert key={warning} variant="warning">
                  <CircleAlert aria-hidden="true" />
                  <AlertDescription>{warning}</AlertDescription>
                </Alert>
              ))}
              <div className="flex flex-wrap items-end gap-3">
                <Field label="Rows already in the census">
                  <NativeSelect
                    value={mode}
                    onChange={(event) => setMode(event.target.value as EbImportMode)}
                  >
                    {EB_IMPORT_MODES.map((value) => (
                      <option key={value} value={value}>
                        {EB_IMPORT_MODE_LABELS[value]}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <p className="text-sm tabular" aria-live="polite">
                  {data.counts.rows} rows read · {data.counts.valid} valid · {data.counts.invalid}{' '}
                  with errors · {data.counts.warnings} with warnings
                </p>
                {data.counts.invalid + data.counts.warnings > 0 ? (
                  <DownloadButton
                    path={`${base}/census/imports/${data.id}/error-report?mode=${mode}`}
                    fallbackName="census-errors.xlsx"
                  >
                    Error report
                  </DownloadButton>
                ) : null}
              </div>
              <PreviewRows rows={data.rows} onCorrect={setCorrecting} />
              <fieldset className="grid gap-2">
                <legend className="mb-1 text-sm font-medium">How to import</legend>
                {GHI_IMPORT_POLICIES.map((value) => (
                  <label key={value} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="import-policy"
                      checked={policy === value}
                      onChange={() => setPolicy(value)}
                      className="accent-[var(--primary)]"
                    />
                    {GHI_IMPORT_POLICY_LABELS[value]}
                  </label>
                ))}
              </fieldset>
              {commit.isError ? (
                <Alert variant="destructive" role="alert">
                  <AlertDescription>{errorMessage(commit.error)}</AlertDescription>
                </Alert>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={!policy || commit.isPending}
                  onClick={() => commit.mutate()}
                >
                  {commit.isPending ? (
                    <LoaderCircle className="animate-spin" aria-hidden="true" />
                  ) : null}
                  Import
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={discard.isPending}
                  onClick={() => discard.mutate()}
                >
                  <X aria-hidden="true" />
                  Set the file aside
                </Button>
              </div>
            </>
          ) : null
        ) : null}
      </CardContent>
      {correcting && importId ? (
        <CorrectRow
          record={record}
          importId={importId}
          mode={mode}
          row={correcting}
          onClose={() => setCorrecting(null)}
        />
      ) : null}
    </Card>
  );
}

function ResultSummary({ result }: { result: EbImportResult }) {
  return (
    <Alert variant="success" role="status">
      <CircleCheck aria-hidden="true" />
      <AlertTitle>Census imported</AlertTitle>
      <AlertDescription>
        <p className="tabular">
          {result.added} added · {result.updated} updated · {result.unchanged} unchanged ·{' '}
          {result.skipped} left out · employees: {result.identitiesCreated} new,{' '}
          {result.identitiesReused} already known
        </p>
        {result.leftOut.length > 0 ? (
          <ul className="mt-2 list-disc pl-4">
            {result.leftOut.map((item) => (
              <li key={item.row}>
                Row {item.row}
                {item.employeeId ? ` (${item.employeeId})` : ''}:{' '}
                {item.issues.map((issue) => issue.message).join('; ')}
              </li>
            ))}
          </ul>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

const MATCH_LABELS = { NEW: 'New', SAME: 'Unchanged', CHANGED: 'Changed' } as const;

function PreviewRows({
  rows,
  onCorrect,
}: {
  rows: EbImportRow[];
  onCorrect: (row: EbImportRow) => void;
}) {
  return (
    <div
      role="region"
      aria-label="Rows of the file"
      tabIndex={0}
      className="max-h-[28rem] overflow-auto rounded-md border"
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Row</TableHead>
            <TableHead>Employee ID</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Relationship</TableHead>
            <TableHead>Match</TableHead>
            <TableHead>Issues</TableHead>
            <TableHead>
              <span className="sr-only">Correct</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.row}>
              <TableCell className="tabular">{row.row}</TableCell>
              <TableCell className="tabular">{row.values.employeeId}</TableCell>
              <TableCell>{row.values.name}</TableCell>
              <TableCell>{row.values.relationship || 'Self'}</TableCell>
              <TableCell>
                {row.match ? <Badge variant="muted">{MATCH_LABELS[row.match]}</Badge> : null}
                {row.corrected ? <Badge variant="info">Corrected</Badge> : null}
              </TableCell>
              <TableCell className="min-w-72">
                {row.issues.length === 0 ? (
                  <span className="text-success">Valid</span>
                ) : (
                  <ul className="grid gap-1 text-xs">
                    {row.issues.map((issue, index) => (
                      <li
                        key={index}
                        className={
                          issue.severity === 'WARNING' ? 'text-warning' : 'text-destructive'
                        }
                      >
                        {issue.severity === 'WARNING' ? 'Warning: ' : ''}
                        {issue.field ? `${EB_CENSUS_FIELD_LABELS[issue.field]}` : ''}
                        {issue.value ? ` “${issue.value}”` : ''}
                        {issue.field || issue.value ? ': ' : ''}
                        {issue.message} <span className="text-muted-foreground">{issue.fix}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </TableCell>
              <TableCell>
                {!row.imported && row.issues.some((issue) => issue.severity === 'ERROR') ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Correct row ${row.row}`}
                    onClick={() => onCorrect(row)}
                  >
                    <Pencil aria-hidden="true" />
                  </Button>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

const FIELDS = [
  'employeeId',
  'name',
  'gender',
  'dateOfBirth',
  'relationship',
  'dateOfJoining',
  'sumInsured',
  'annualSalary',
] as const;

function CorrectRow({
  record,
  importId,
  mode,
  row,
  onClose,
}: {
  record: EbCaseRecord;
  importId: string;
  mode: EbImportMode;
  row: EbImportRow;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<EbCensusRowValues>(row.values);
  const save = useMutation({
    mutationFn: () =>
      apiFetch(`${caseApi(record.product, record.id)}/census/imports/${importId}/rows/${row.row}`, {
        method: 'PUT',
        body: { values, mode },
        schema: EbCensusImportSchema,
      }),
    onSuccess: () => {
      refreshGhiCase(queryClient, record.id);
      onClose();
    },
  });
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Correct row {row.row}</DialogTitle>
          <DialogDescription>
            The row and its family are checked again. Dates as DD/MM/YYYY.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          {FIELDS.map((field) => (
            <Field key={field} label={EB_CENSUS_FIELD_LABELS[field]}>
              <Input
                value={values[field]}
                onChange={(event) =>
                  setValues((current) => ({ ...current, [field]: event.target.value }))
                }
              />
              {row.issues
                .filter((issue) => issue.field === field)
                .map((issue, index) => (
                  <span key={index} className="text-xs text-destructive">
                    {issue.message}
                  </span>
                ))}
            </Field>
          ))}
        </div>
        {save.isError ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{errorMessage(save.error)}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={save.isPending} onClick={() => save.mutate()}>
            Save correction
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
