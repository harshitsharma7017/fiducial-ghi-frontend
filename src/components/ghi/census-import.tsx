'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleAlert, FileUp, LoaderCircle, Pencil } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { errorMessage } from '@/components/states';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { ApiError, apiFetch } from '@/lib/api-client';
import { ghiImportQuery, ghiImportsQuery, ghiKeys, refreshGhiCase } from '@/lib/api/ghi';
import { cn } from '@/lib/utils';
import {
  GHI_CENSUS_COLUMNS,
  GHI_CENSUS_FIELD_LABELS,
  GHI_IMPORT_POLICIES,
  GHI_IMPORT_POLICY_LABELS,
  GhiCensusImportSchema,
  GhiCommitResultSchema,
  XLSX_CONTENT_TYPE,
  type GhiCaseRecord,
  type GhiCensusImport,
  type GhiCensusRowValues,
  type GhiImportPolicy,
  type GhiImportRow,
} from '@/shared';

/**
 * The census file (G3): uploaded and checked row by row (the Excel row, the field and what to
 * do), corrected on screen, then imported by an explicit policy in one transaction.
 */
export function CensusImport({ record }: { record: GhiCaseRecord }) {
  const queryClient = useQueryClient();
  const imports = useQuery(ghiImportsQuery(record.id));
  // The upload being worked on; until one is chosen, an upload not imported yet is picked up again.
  const [chosenId, setImportId] = useState<string | null | undefined>(undefined);
  const importId =
    chosenId === undefined
      ? (imports.data?.items.find((item) => item.status === 'PREVIEW')?.id ?? null)
      : chosenId;
  const input = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const upload = useMutation({
    mutationFn: (file: File) =>
      apiFetch(`ghi/cases/${record.id}/census/imports?fileName=${encodeURIComponent(file.name)}`, {
        method: 'POST',
        body: new Blob([file], { type: XLSX_CONTENT_TYPE }),
        schema: GhiCensusImportSchema,
      }),
    onSuccess: (checked) => {
      queryClient.setQueryData(ghiImportQuery(record.id, checked.id).queryKey, checked);
      void queryClient.invalidateQueries({ queryKey: ghiKeys.part(record.id, 'census/imports') });
      setImportId(checked.id);
    },
  });
  const fileIssues =
    upload.error instanceof ApiError &&
    Array.isArray((upload.error.details as { issues?: unknown } | undefined)?.issues)
      ? (upload.error.details as { issues: string[] }).issues
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import the census</CardTitle>
        <CardDescription>
          Fill the census template (one row per insured life) and upload it. Every row is checked
          first; nothing joins the census until you import.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={input}
            id={inputId}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            aria-label="Census workbook"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) upload.mutate(file);
              event.target.value = '';
            }}
          />
          <Button
            type="button"
            variant="outline"
            disabled={upload.isPending}
            onClick={() => input.current?.click()}
          >
            {upload.isPending ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : (
              <FileUp aria-hidden="true" />
            )}
            Upload census file
          </Button>
        </div>
        {upload.isError ? (
          <Alert variant="destructive" role="alert">
            <CircleAlert aria-hidden="true" />
            <AlertTitle>The file was not checked</AlertTitle>
            <AlertDescription>
              {fileIssues ? (
                <ul className="list-disc pl-4">
                  {fileIssues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              ) : (
                errorMessage(upload.error)
              )}
            </AlertDescription>
          </Alert>
        ) : null}
        {importId ? (
          <ImportPreview
            record={record}
            importId={importId}
            onDone={() => {
              setImportId(null);
              refreshGhiCase(queryClient, record.id);
            }}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

function ImportPreview({
  record,
  importId,
  onDone,
}: {
  record: GhiCaseRecord;
  importId: string;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const query = useQuery(ghiImportQuery(record.id, importId));
  const [onlyProblems, setOnlyProblems] = useState(true);
  const [policy, setPolicy] = useState<GhiImportPolicy>('ALL_VALID');
  const [correcting, setCorrecting] = useState<GhiImportRow | null>(null);
  const setData = (data: GhiCensusImport) =>
    queryClient.setQueryData(ghiImportQuery(record.id, importId).queryKey, data);
  const commit = useMutation({
    mutationFn: () =>
      apiFetch(`ghi/cases/${record.id}/census/imports/${importId}/commit`, {
        method: 'POST',
        body: { policy },
        schema: GhiCommitResultSchema,
      }),
    onSuccess: (result) => {
      setData(result.import);
      toast({
        title: `${result.imported} member(s) imported`,
        description:
          result.skipped > 0
            ? `${result.skipped} row(s) with problems were left out.`
            : 'Every row was imported.',
        variant: 'success',
      });
      onDone();
    },
  });
  const discard = useMutation({
    mutationFn: () =>
      apiFetch(`ghi/cases/${record.id}/census/imports/${importId}/discard`, {
        method: 'POST',
        schema: GhiCensusImportSchema,
      }),
    onSuccess: () => onDone(),
  });
  if (query.isPending)
    return (
      <p className="text-sm text-muted-foreground" role="status">
        Checking the file…
      </p>
    );
  if (query.isError)
    return (
      <p role="alert" className="text-sm text-destructive">
        {errorMessage(query.error)}
      </p>
    );
  const data = query.data;
  if (data.status !== 'PREVIEW') return null;
  const rows = onlyProblems ? data.rows.filter((row) => !row.valid) : data.rows;

  return (
    <div className="grid gap-4 rounded-md border p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">{data.fileName}</span>
        <Badge variant="muted" className="tabular">
          {data.counts.rows} rows
        </Badge>
        <Badge variant="success" className="tabular">
          {data.counts.valid} valid
        </Badge>
        {data.counts.invalid > 0 ? (
          <Badge variant="destructive" className="tabular">
            {data.counts.invalid} with problems
          </Badge>
        ) : null}
        <Label className="ml-auto flex items-center gap-2 font-normal">
          <Checkbox
            checked={onlyProblems}
            onCheckedChange={(checked) => setOnlyProblems(checked === true)}
          />
          Show only rows with problems
        </Label>
      </div>
      <div
        role="region"
        aria-label="Checked census rows"
        tabIndex={0}
        className="max-h-[28rem] overflow-auto rounded-md border"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">Row</TableHead>
              {GHI_CENSUS_COLUMNS.map((column) => (
                <TableHead key={column.key}>{column.header}</TableHead>
              ))}
              <TableHead>Problems</TableHead>
              <TableHead>
                <span className="sr-only">Correct</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={GHI_CENSUS_COLUMNS.length + 3} className="text-sm text-success">
                  Every row is valid.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const bad = new Set(row.issues.map((issue) => issue.field));
                return (
                  <TableRow
                    key={row.row}
                    className={row.valid ? undefined : 'bg-destructive-soft/40'}
                  >
                    <TableCell className="text-right tabular">{row.row}</TableCell>
                    {GHI_CENSUS_COLUMNS.map((column) => (
                      <TableCell
                        key={column.key}
                        className={cn(
                          'whitespace-nowrap',
                          bad.has(column.key) && 'font-medium text-destructive',
                        )}
                      >
                        {row.values[column.key] || '—'}
                      </TableCell>
                    ))}
                    <TableCell className="min-w-72">
                      {row.issues.length === 0 ? (
                        <span className="text-success">
                          {row.corrected ? 'Valid (corrected)' : 'Valid'}
                        </span>
                      ) : (
                        <ul className="grid gap-0.5">
                          {row.issues.map((issue, index) => (
                            <li key={index}>
                              {issue.field ? (
                                <span className="font-medium">
                                  {GHI_CENSUS_FIELD_LABELS[issue.field]}:{' '}
                                </span>
                              ) : null}
                              {issue.message}
                            </li>
                          ))}
                        </ul>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Correct row ${row.row}`}
                        onClick={() => setCorrecting(row)}
                      >
                        <Pencil aria-hidden="true" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">Import policy</legend>
        {GHI_IMPORT_POLICIES.map((value) => (
          <label key={value} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name={`policy-${importId}`}
              checked={policy === value}
              onChange={() => setPolicy(value)}
              className="size-4 accent-[var(--primary)]"
            />
            {GHI_IMPORT_POLICY_LABELS[value]}
          </label>
        ))}
        <p className="text-xs text-muted-foreground">
          Either way the rows are checked again against the census at the moment of import, in one
          transaction. A dependant whose employee’s row fails is left out with it.
        </p>
      </fieldset>
      {commit.isError || discard.isError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{errorMessage(commit.error ?? discard.error)}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={discard.isPending}
          onClick={() => discard.mutate()}
        >
          Set the file aside
        </Button>
        <Button
          type="button"
          disabled={
            commit.isPending ||
            data.counts.valid === 0 ||
            (policy === 'ALL_VALID' && data.counts.invalid > 0)
          }
          onClick={() => commit.mutate()}
        >
          {commit.isPending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
          {policy === 'ALL_VALID'
            ? `Import all ${data.counts.rows} rows`
            : `Import ${data.counts.valid} valid rows`}
        </Button>
      </div>
      {correcting ? (
        <CorrectRowDialog
          record={record}
          importId={importId}
          row={correcting}
          onClose={(updated) => {
            if (updated) setData(updated);
            setCorrecting(null);
          }}
        />
      ) : null}
    </div>
  );
}

function CorrectRowDialog({
  record,
  importId,
  row,
  onClose,
}: {
  record: GhiCaseRecord;
  importId: string;
  row: GhiImportRow;
  onClose: (updated: GhiCensusImport | null) => void;
}) {
  const [values, setValues] = useState<GhiCensusRowValues>(row.values);
  const save = useMutation({
    mutationFn: () =>
      apiFetch(`ghi/cases/${record.id}/census/imports/${importId}/rows/${row.row}`, {
        method: 'PUT',
        body: { values },
        schema: GhiCensusImportSchema,
      }),
    onSuccess: (updated) => onClose(updated),
  });
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose(null))}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Correct row {row.row}</DialogTitle>
          <DialogDescription>
            As in the file. Dates as DD/MM/YYYY; relationship as Self, Spouse, Child, Father,
            Mother, Father-in-law or Mother-in-law.
          </DialogDescription>
        </DialogHeader>
        {row.issues.length > 0 ? (
          <ul className="grid gap-0.5 text-sm text-destructive">
            {row.issues.map((issue, index) => (
              <li key={index}>
                {issue.field ? `${GHI_CENSUS_FIELD_LABELS[issue.field]}: ` : ''}
                {issue.message}
              </li>
            ))}
          </ul>
        ) : null}
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {GHI_CENSUS_COLUMNS.map((column) => (
              <Label key={column.key} className="grid gap-1 text-sm font-normal">
                {column.header}
                <Input
                  value={values[column.key]}
                  maxLength={200}
                  aria-invalid={
                    row.issues.some((issue) => issue.field === column.key) ? true : undefined
                  }
                  onChange={(event) =>
                    setValues((current) => ({ ...current, [column.key]: event.target.value }))
                  }
                />
              </Label>
            ))}
          </div>
          {save.isError ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{errorMessage(save.error)}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onClose(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
              Check again
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
