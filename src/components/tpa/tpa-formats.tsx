'use client';

import { useQuery } from '@tanstack/react-query';
import type * as React from 'react';
import { FileSearch, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { EmptyState, ErrorState, TableLoadingRows, errorMessage } from '@/components/states';
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
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api-client';
import { issuesText } from '@/lib/api/claims';
import {
  importSettingsQuery,
  inspectTpaFile,
  tpaFormatsQuery,
  useTpaMutation,
} from '@/lib/api/tpa';
import {
  CLAIM_STATUSES,
  CLAIM_STATUS_LABELS,
  CLAIM_TYPE_LABELS,
  ClaimImportSettingsResponseSchema,
  GHI_RELATIONSHIPS,
  GHI_RELATIONSHIP_LABELS,
  TPA_CLAIM_FIELDS,
  TPA_CLAIM_STATUSES,
  TPA_CLAIM_STATUS_LABELS,
  TPA_CLAIM_TYPES,
  TPA_DEFAULT_CLAIM_TYPES,
  TPA_DEFAULT_REQUEST_TYPES,
  TPA_FIELD_INFO,
  TPA_REQUEST_TYPES,
  TPA_REQUEST_TYPE_LABELS,
  TPA_SUGGESTED_BOARD_MAP,
  TPA_SUGGESTED_STATUS_MAP,
  TpaFormatSchema,
  formatDateTime,
  type ClaimStatus,
  type TpaClaimField,
  type TpaFormat,
} from '@/shared';
import { CompanyFilter } from '@/components/claims/claim-ui';

// TPA formats (N9 1, N11 1) and the import email settings (N11 4), for Admins. A format says
// which column holds each field, how the TPA's statuses read, and which board column each status
// puts a claim in. Suggested values are offered as a start; only what is saved is used.

interface Draft {
  name: string;
  tpaCode: string;
  description: string;
  sheetName: string;
  headerRow: number;
  headers: Record<TpaClaimField, string>;
  required: Record<TpaClaimField, boolean>;
  statusMap: Array<{ source: string; status: string }>;
  requestTypeMap: Array<{ source: string; requestType: string }>;
  claimTypeMap: Array<{ source: string; claimType: string }>;
  relationshipMap: Array<{ source: string; relationship: string }>;
  keepColumns: string;
  requireMemberMatch: boolean;
  boardStatusMap: Array<{ source: string; boardStatus: string }>;
  boardStatusOverrides: Array<{ clientId: string; source: string; boardStatus: string }>;
  boardUpdate: 'FORWARD_ONLY' | 'NEVER';
  createBoardClaims: boolean;
}

const blankFields = <T,>(value: T) =>
  Object.fromEntries(TPA_CLAIM_FIELDS.map((field) => [field, value])) as Record<TpaClaimField, T>;

function draftOf(format: TpaFormat | null): Draft {
  const headers = blankFields('');
  const required = blankFields(false);
  required.tpaClaimId = true;
  required.status = true;
  for (const mapping of format?.mappings ?? []) {
    headers[mapping.field] = mapping.header;
    required[mapping.field] = mapping.required;
  }
  return {
    name: format?.name ?? '',
    tpaCode: format?.tpaCode ?? '',
    description: format?.description ?? '',
    sheetName: format?.sheetName ?? '',
    headerRow: format?.headerRow ?? 1,
    headers,
    required,
    statusMap: format ? format.statusMap : TPA_SUGGESTED_STATUS_MAP.map((item) => ({ ...item })),
    requestTypeMap: format
      ? format.requestTypeMap
      : TPA_DEFAULT_REQUEST_TYPES.map((item) => ({ ...item })),
    claimTypeMap: format
      ? format.claimTypeMap
      : TPA_DEFAULT_CLAIM_TYPES.map((item) => ({ ...item })),
    relationshipMap: format?.relationshipMap ?? [],
    keepColumns: (format?.keepColumns ?? []).join(', '),
    requireMemberMatch: format?.requireMemberMatch ?? false,
    boardStatusMap: format
      ? format.boardStatusMap
      : TPA_SUGGESTED_BOARD_MAP.map((item) => ({ ...item })),
    boardStatusOverrides: format?.boardStatusOverrides ?? [],
    boardUpdate: format?.boardUpdate ?? 'FORWARD_ONLY',
    createBoardClaims: format?.createBoardClaims ?? true,
  };
}

function bodyOf(draft: Draft) {
  return {
    name: draft.name,
    tpaCode: draft.tpaCode,
    description: draft.description.trim() || null,
    sheetName: draft.sheetName.trim() || null,
    headerRow: draft.headerRow,
    mappings: TPA_CLAIM_FIELDS.filter((field) => draft.headers[field].trim()).map((field) => ({
      field,
      header: draft.headers[field].trim(),
      required: draft.required[field],
    })),
    statusMap: draft.statusMap.filter((item) => item.source.trim()),
    requestTypeMap: draft.requestTypeMap.filter((item) => item.source.trim()),
    claimTypeMap: draft.claimTypeMap.filter((item) => item.source.trim()),
    relationshipMap: draft.relationshipMap.filter((item) => item.source.trim()),
    keepColumns: draft.keepColumns
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
    requireMemberMatch: draft.requireMemberMatch,
    boardStatusMap: draft.boardStatusMap.filter((item) => item.source.trim()),
    boardStatusOverrides: draft.boardStatusOverrides.filter(
      (item) => item.source.trim() && item.clientId,
    ),
    boardUpdate: draft.boardUpdate,
    createBoardClaims: draft.createBoardClaims,
  };
}

export function TpaFormatsPanel() {
  const formats = useQuery(tpaFormatsQuery());
  const [editing, setEditing] = useState<TpaFormat | 'new' | null>(null);
  const toggle = useTpaMutation(
    (format: TpaFormat) =>
      apiFetch(`tpa/formats/${format.id}/${format.active ? 'deactivate' : 'activate'}`, {
        method: 'POST',
        schema: TpaFormatSchema,
      }),
    (result) => ({ title: result.active ? 'Format active' : 'Format inactive' }),
  );
  return (
    <div className="grid gap-6">
      <ImportSettingsCard />
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
          <div className="grid gap-1">
            <CardTitle>TPA formats</CardTitle>
            <CardDescription>
              One per TPA layout. Exact client layouts are not confirmed yet: set each up from a
              real file of the TPA.
            </CardDescription>
          </div>
          <Button onClick={() => setEditing('new')}>
            <Plus aria-hidden="true" />
            New format
          </Button>
        </CardHeader>
        <CardContent>
          {formats.isError ? (
            <ErrorState error={formats.error} onRetry={() => void formats.refetch()} />
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Format</TableHead>
                    <TableHead>TPA code</TableHead>
                    <TableHead className="text-right">Columns</TableHead>
                    <TableHead className="text-right">Statuses</TableHead>
                    <TableHead className="text-right">Board columns</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {formats.isPending ? (
                    <TableLoadingRows columns={7} rows={3} />
                  ) : formats.data.items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <EmptyState
                          title="No formats yet"
                          description="Create one from a TPA’s claims file."
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    formats.data.items.map((format) => (
                      <TableRow key={format.id}>
                        <TableCell className="font-medium">{format.name}</TableCell>
                        <TableCell>{format.tpaCode}</TableCell>
                        <TableCell className="text-right tabular">
                          {format.mappings.length}
                        </TableCell>
                        <TableCell className="text-right tabular">
                          {format.statusMap.length}
                        </TableCell>
                        <TableCell className="text-right tabular">
                          {format.boardStatusMap.length}
                        </TableCell>
                        <TableCell>
                          <Badge variant={format.active ? 'success' : 'muted'}>
                            {format.active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setEditing(format)}>
                            <Pencil aria-hidden="true" />
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={toggle.isPending}
                            onClick={() => toggle.mutate(format)}
                          >
                            {format.active ? 'Deactivate' : 'Activate'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      {editing ? (
        <FormatDialog
          format={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}

/** N11 4: whether TPA imports email the claimant and HR. Off until the client approves. */
function ImportSettingsCard() {
  const settings = useQuery(importSettingsQuery());
  const save = useTpaMutation(
    (body: { notifyOnImportStatusChange: boolean; notifyOnImportCreate: boolean }) =>
      apiFetch('tpa/settings', {
        method: 'PUT',
        body,
        schema: ClaimImportSettingsResponseSchema,
      }),
    () => ({ title: 'Import email settings saved' }),
  );
  if (settings.isError)
    return <ErrorState error={settings.error} onRetry={() => void settings.refetch()} />;
  const data = settings.data;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Emails from TPA imports</CardTitle>
        <CardDescription>
          Staff moves on the board always email as configured. These settings cover only what a TPA
          file changes. Both stay off until the client approves them (open question N11-2). Emails
          never contain a diagnosis.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {data ? (
          <>
            {(
              [
                [
                  'notifyOnImportStatusChange',
                  'Email the claimant and HR when an import moves a claim to another board column',
                ],
                [
                  'notifyOnImportCreate',
                  'Email when an import adds a claim to the board (only where an email address is known)',
                ],
              ] as const
            ).map(([key, label]) => (
              <Label key={key} className="flex items-center gap-2 text-sm font-normal">
                <Checkbox
                  checked={data[key]}
                  disabled={save.isPending}
                  onCheckedChange={(checked) =>
                    save.mutate({
                      notifyOnImportStatusChange: data.notifyOnImportStatusChange,
                      notifyOnImportCreate: data.notifyOnImportCreate,
                      [key]: checked === true,
                    })
                  }
                />
                {label}
              </Label>
            ))}
            <p className="text-xs text-muted-foreground">
              {data.updatedAt
                ? `Last changed ${formatDateTime(data.updatedAt)} by ${data.updatedBy ?? ''}.`
                : 'Never changed: the safe default (no import emails) applies.'}
            </p>
          </>
        ) : (
          <span className="text-sm text-muted-foreground">Loading…</span>
        )}
        {save.error ? (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage(save.error)}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}

function RowsEditor<T extends { source: string }>({
  title,
  description,
  rows,
  onChange,
  blank,
  renderValue,
  suggestions,
}: {
  title: string;
  description?: string;
  rows: T[];
  onChange: (rows: T[]) => void;
  blank: T;
  renderValue: (row: T, set: (row: T) => void) => React.ReactNode;
  suggestions?: string[];
}) {
  return (
    <fieldset className="grid gap-2 rounded-md border p-3">
      <legend className="px-1 text-sm font-semibold">{title}</legend>
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      {rows.map((row, index) => (
        <div key={index} className="flex flex-wrap items-center gap-2">
          <Input
            aria-label={`${title}: TPA value ${index + 1}`}
            className="w-56"
            value={row.source}
            placeholder="As written by the TPA"
            onChange={(event) =>
              onChange(
                rows.map((item, at) =>
                  at === index ? { ...item, source: event.target.value } : item,
                ),
              )
            }
          />
          <span aria-hidden="true">→</span>
          {renderValue(row, (next) =>
            onChange(rows.map((item, at) => (at === index ? next : item))),
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={`Remove ${row.source || 'row'}`}
            onClick={() => onChange(rows.filter((_, at) => at !== index))}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...rows, { ...blank }])}
        >
          <Plus aria-hidden="true" />
          Add
        </Button>
        {suggestions && suggestions.length > 0 ? (
          <span className="text-xs text-muted-foreground">
            In the sample file: {suggestions.join(', ')}
          </span>
        ) : null}
      </div>
    </fieldset>
  );
}

function FormatDialog({ format, onClose }: { format: TpaFormat | null; onClose: () => void }) {
  const [draft, setDraft] = useState<Draft>(() => draftOf(format));
  const [sample, setSample] = useState<{ headers: string[]; statuses: string[] } | null>(null);
  const [sampleError, setSampleError] = useState<unknown>(null);
  const set = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));
  const save = useTpaMutation(
    () =>
      apiFetch(format ? `tpa/formats/${format.id}` : 'tpa/formats', {
        method: format ? 'PUT' : 'POST',
        body: bodyOf(draft),
        schema: TpaFormatSchema,
      }),
    () => ({ title: format ? 'Format saved' : 'Format created' }),
  );
  const readSample = (file: File) => {
    setSampleError(null);
    inspectTpaFile(file, {
      sheetName: draft.sheetName.trim() || undefined,
      headerRow: draft.headerRow,
    })
      .then((result) => {
        const headers = { ...draft.headers };
        for (const suggestion of result.suggestions) {
          if (!headers[suggestion.field]) headers[suggestion.field] = suggestion.header;
        }
        set({ headers, sheetName: draft.sheetName || result.sheet });
        setSample({
          headers: result.headers.filter(Boolean),
          statuses: result.statusValues.map((item) => `${item.value} (${item.rows})`),
        });
      })
      .catch(setSampleError);
  };
  const fieldError = issuesText(save.error);

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{format ? `Edit ${format.name}` : 'New TPA format'}</DialogTitle>
          <DialogDescription>
            A saved change applies to files checked afterwards; files already checked keep the
            format as it was.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate(undefined, { onSuccess: onClose });
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Label className="grid gap-1 text-sm font-normal">
              Name
              <Input value={draft.name} onChange={(event) => set({ name: event.target.value })} />
            </Label>
            <Label className="grid gap-1 text-sm font-normal">
              TPA code (part of each claim’s key: it cannot change once claims are imported)
              <Input
                value={draft.tpaCode}
                onChange={(event) => set({ tpaCode: event.target.value.toUpperCase() })}
              />
            </Label>
            <Label className="grid gap-1 text-sm font-normal">
              Sheet (empty: the first sheet)
              <Input
                value={draft.sheetName}
                onChange={(event) => set({ sheetName: event.target.value })}
              />
            </Label>
            <Label className="grid gap-1 text-sm font-normal">
              Header row
              <Input
                type="number"
                min={1}
                max={50}
                value={draft.headerRow}
                onChange={(event) => set({ headerRow: Number(event.target.value) || 1 })}
              />
            </Label>
            <Label className="grid gap-1 text-sm font-normal sm:col-span-2">
              Description
              <Textarea
                value={draft.description}
                onChange={(event) => set({ description: event.target.value })}
              />
            </Label>
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed p-3">
            <FileSearch aria-hidden="true" className="size-4" />
            <Label className="flex flex-wrap items-center gap-2 text-sm font-normal">
              Read the headers of a sample file (nothing is imported):
              <Input
                type="file"
                accept=".xlsx"
                className="w-72"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) readSample(file);
                }}
              />
            </Label>
            {sample ? (
              <span className="text-xs text-muted-foreground">
                {sample.headers.length} columns read; empty fields were filled from similar headers.
                Check each one.
              </span>
            ) : null}
            {sampleError ? (
              <span className="text-xs text-destructive">{errorMessage(sampleError)}</span>
            ) : null}
          </div>
          <fieldset className="grid gap-2 rounded-md border p-3">
            <legend className="px-1 text-sm font-semibold">Columns</legend>
            <p className="text-xs text-muted-foreground">
              The column header holding each field, as written in the file. Leave a field empty when
              the TPA does not send it. The claim ID and the status are always required.
            </p>
            <div className="grid gap-2 md:grid-cols-2">
              {TPA_CLAIM_FIELDS.map((field) => (
                <div key={field} className="grid grid-cols-[1fr_auto] items-end gap-2">
                  <Label className="grid gap-1 text-sm font-normal">
                    {TPA_FIELD_INFO[field].label}
                    {TPA_FIELD_INFO[field].sensitive ? ' (restricted)' : ''}
                    <Input
                      list="tpa-sample-headers"
                      value={draft.headers[field]}
                      onChange={(event) =>
                        set({ headers: { ...draft.headers, [field]: event.target.value } })
                      }
                    />
                  </Label>
                  <Label className="flex items-center gap-1 pb-2 text-xs font-normal">
                    <Checkbox
                      checked={draft.required[field]}
                      disabled={field === 'tpaClaimId' || field === 'status'}
                      onCheckedChange={(checked) =>
                        set({ required: { ...draft.required, [field]: checked === true } })
                      }
                    />
                    Required
                  </Label>
                </div>
              ))}
            </div>
            <datalist id="tpa-sample-headers">
              {(sample?.headers ?? []).map((header) => (
                <option key={header} value={header} />
              ))}
            </datalist>
            <Label className="grid gap-1 text-sm font-normal">
              Other columns to keep with each claim, comma separated (not sensitive ones)
              <Input
                value={draft.keepColumns}
                onChange={(event) => set({ keepColumns: event.target.value })}
              />
            </Label>
            <Label className="flex items-center gap-2 text-sm font-normal">
              <Checkbox
                checked={draft.requireMemberMatch}
                onCheckedChange={(checked) => set({ requireMemberMatch: checked === true })}
              />
              Refuse a row whose employee or patient is not in the census (otherwise a warning)
            </Label>
          </fieldset>
          <RowsEditor
            title="Statuses"
            description="How each TPA status counts. A status not listed makes its row an error: it is never guessed."
            rows={draft.statusMap}
            onChange={(statusMap) => set({ statusMap })}
            blank={{ source: '', status: 'OUTSTANDING' }}
            suggestions={sample?.statuses}
            renderValue={(row, update) => (
              <NativeSelect
                aria-label={`Status for ${row.source}`}
                className="w-44"
                value={row.status}
                onChange={(event) => update({ ...row, status: event.target.value })}
              >
                {TPA_CLAIM_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {TPA_CLAIM_STATUS_LABELS[value]}
                  </option>
                ))}
              </NativeSelect>
            )}
          />
          <RowsEditor
            title="Claims board columns"
            description="The board column each TPA status puts a claim in. Claims move forward only. A status not listed leaves the board as it is and is reported after the import."
            rows={draft.boardStatusMap}
            onChange={(boardStatusMap) => set({ boardStatusMap })}
            blank={{ source: '', boardStatus: 'SUBMITTED' }}
            suggestions={sample?.statuses}
            renderValue={(row, update) => (
              <BoardSelect
                label={`Board column for ${row.source}`}
                value={row.boardStatus}
                onChange={(boardStatus) => update({ ...row, boardStatus })}
              />
            )}
          />
          <fieldset className="grid gap-2 rounded-md border p-3">
            <legend className="px-1 text-sm font-semibold">Company-specific board columns</legend>
            <p className="text-xs text-muted-foreground">
              A company whose claims go to another column for a status. These come before the map
              above.
            </p>
            {draft.boardStatusOverrides.map((row, index) => {
              const update = (next: typeof row) =>
                set({
                  boardStatusOverrides: draft.boardStatusOverrides.map((item, at) =>
                    at === index ? next : item,
                  ),
                });
              return (
                <div key={index} className="flex flex-wrap items-center gap-2">
                  <CompanyFilter
                    value={row.clientId}
                    onChange={(clientId) => update({ ...row, clientId })}
                  />
                  <Input
                    aria-label={`Override ${index + 1}: TPA status`}
                    className="w-48"
                    value={row.source}
                    placeholder="TPA status"
                    onChange={(event) => update({ ...row, source: event.target.value })}
                  />
                  <BoardSelect
                    label={`Override ${index + 1}: board column`}
                    value={row.boardStatus}
                    onChange={(boardStatus) => update({ ...row, boardStatus })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label="Remove override"
                    onClick={() =>
                      set({
                        boardStatusOverrides: draft.boardStatusOverrides.filter(
                          (_, at) => at !== index,
                        ),
                      })
                    }
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              );
            })}
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  set({
                    boardStatusOverrides: [
                      ...draft.boardStatusOverrides,
                      { clientId: '', source: '', boardStatus: 'SUBMITTED' },
                    ],
                  })
                }
              >
                <Plus aria-hidden="true" />
                Add
              </Button>
            </div>
            <Label className="grid gap-1 text-sm font-normal">
              Imports and board claims
              <NativeSelect
                className="w-80"
                value={draft.boardUpdate}
                onChange={(event) =>
                  set({ boardUpdate: event.target.value as Draft['boardUpdate'] })
                }
              >
                <option value="FORWARD_ONLY">Move board claims forward only</option>
                <option value="NEVER">Never move board claims</option>
              </NativeSelect>
            </Label>
            <Label className="flex items-center gap-2 text-sm font-normal">
              <Checkbox
                checked={draft.createBoardClaims}
                onCheckedChange={(checked) => set({ createBoardClaims: checked === true })}
              />
              Add a GMC claim to the board when it is matched to the census and not there yet
            </Label>
          </fieldset>
          <RowsEditor
            title="Request types"
            rows={draft.requestTypeMap}
            onChange={(requestTypeMap) => set({ requestTypeMap })}
            blank={{ source: '', requestType: 'MAIN' }}
            renderValue={(row, update) => (
              <NativeSelect
                aria-label={`Request type for ${row.source}`}
                className="w-56"
                value={row.requestType}
                onChange={(event) => update({ ...row, requestType: event.target.value })}
              >
                {TPA_REQUEST_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {TPA_REQUEST_TYPE_LABELS[value]}
                  </option>
                ))}
              </NativeSelect>
            )}
          />
          <RowsEditor
            title="Cashless and reimbursement"
            rows={draft.claimTypeMap}
            onChange={(claimTypeMap) => set({ claimTypeMap })}
            blank={{ source: '', claimType: 'CASHLESS' }}
            renderValue={(row, update) => (
              <NativeSelect
                aria-label={`Claim type for ${row.source}`}
                className="w-44"
                value={row.claimType}
                onChange={(event) => update({ ...row, claimType: event.target.value })}
              >
                {TPA_CLAIM_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {CLAIM_TYPE_LABELS[value]}
                  </option>
                ))}
              </NativeSelect>
            )}
          />
          <RowsEditor
            title="Relationships"
            description="Only where the TPA writes them differently from the census (Self, Spouse, Child, Father…)."
            rows={draft.relationshipMap}
            onChange={(relationshipMap) => set({ relationshipMap })}
            blank={{ source: '', relationship: 'SPOUSE' }}
            renderValue={(row, update) => (
              <NativeSelect
                aria-label={`Relationship for ${row.source}`}
                className="w-44"
                value={row.relationship}
                onChange={(event) => update({ ...row, relationship: event.target.value })}
              >
                {GHI_RELATIONSHIPS.map((value) => (
                  <option key={value} value={value}>
                    {GHI_RELATIONSHIP_LABELS[value]}
                  </option>
                ))}
              </NativeSelect>
            )}
          />
          {save.error ? (
            <Alert variant="destructive">
              <AlertTitle>{errorMessage(save.error)}</AlertTitle>
              {fieldError ? <AlertDescription>{fieldError}</AlertDescription> : null}
            </Alert>
          ) : null}
          <DialogFooter>
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

function BoardSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: ClaimStatus) => void;
}) {
  return (
    <NativeSelect
      aria-label={label}
      className="w-44"
      value={value}
      onChange={(event) => onChange(event.target.value as ClaimStatus)}
    >
      {CLAIM_STATUSES.map((status) => (
        <option key={status} value={status}>
          {CLAIM_STATUS_LABELS[status]}
        </option>
      ))}
    </NativeSelect>
  );
}
