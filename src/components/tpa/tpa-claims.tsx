'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type * as React from 'react';
import Link from 'next/link';
import { useState } from 'react';
import { inr } from '@/components/claims/claim-ui';
import { Pager } from '@/components/ghi/ghi-ui';
import { EmptyState, ErrorState, TableLoadingRows, errorMessage } from '@/components/states';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { usePermission } from '@/hooks/use-permission';
import { apiFetch } from '@/lib/api-client';
import {
  tpaClaimHistoryQuery,
  tpaClaimQuery,
  tpaClaimsQuery,
  useTpaMutation,
  type TpaClaimFilters,
} from '@/lib/api/tpa';
import {
  CLAIM_TYPE_LABELS,
  GHI_RELATIONSHIP_LABELS,
  TPA_CLAIM_STATUSES,
  TPA_CLAIM_STATUS_LABELS,
  TPA_REQUEST_TYPE_LABELS,
  TpaClaimRecordSchema,
  formatDate,
  formatDateTime,
  type TpaClaimRecord,
  type TpaClaimStatus,
} from '@/shared';
import { PolicyPicker, TpaStatusBadge } from './tpa-ui';

const MATCH_LABEL: Record<TpaClaimRecord['member']['match'], string> = {
  MATCHED: 'Matched to the census',
  NOT_FOUND: 'Not in the census',
  AMBIGUOUS: 'Several census members fit',
  NO_EMPLOYEE_ID: 'No employee ID',
};

/** The claims imported from TPA files for one policy (N9), with those needing a person first. */
export function TpaClaimsPanel() {
  const [caseId, setCaseId] = useState('');
  const [status, setStatus] = useState<TpaClaimStatus | ''>('');
  const [review, setReview] = useState(false);
  const [text, setText] = useState('');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState('');
  const q = useDebouncedValue(text, 250);
  const filters: TpaClaimFilters = { caseId, status, review, q, page };
  const claims = useQuery({ ...tpaClaimsQuery(filters), placeholderData: keepPreviousData });
  const pages = claims.data ? Math.max(1, Math.ceil(claims.data.total / claims.data.limit)) : 1;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <PolicyPicker
          value={caseId}
          onChange={(value) => {
            setCaseId(value);
            setPage(1);
          }}
        />
        <Label className="grid gap-1 text-sm font-normal">
          Status
          <NativeSelect
            className="w-44"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as TpaClaimStatus | '');
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {TPA_CLAIM_STATUSES.map((value) => (
              <option key={value} value={value}>
                {TPA_CLAIM_STATUS_LABELS[value]}
              </option>
            ))}
          </NativeSelect>
        </Label>
        <Label className="grid gap-1 text-sm font-normal">
          Search
          <Input
            className="w-56"
            placeholder="Claim ID, employee ID or name"
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setPage(1);
            }}
          />
        </Label>
        <Label className="flex items-center gap-2 pb-2 text-sm font-normal">
          <Checkbox
            checked={review}
            onCheckedChange={(checked) => {
              setReview(checked === true);
              setPage(1);
            }}
          />
          Needs review only
        </Label>
      </div>
      {!caseId ? (
        <EmptyState
          title="Choose a policy"
          description="The claims imported from TPA files for that policy are listed here."
        />
      ) : claims.isError ? (
        <ErrorState error={claims.error} onRetry={() => void claims.refetch()} />
      ) : (
        <div
          role="region"
          aria-label="Imported TPA claims"
          tabIndex={0}
          className="overflow-x-auto rounded-md border"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>TPA claim</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Admitted</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Claimed</TableHead>
                <TableHead className="text-right">Settled</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Board</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {claims.isPending ? (
                <TableLoadingRows columns={8} />
              ) : claims.data.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8}>
                    <EmptyState
                      title="No claims"
                      description={
                        review
                          ? 'Nothing needs review.'
                          : 'No claim matches, or no TPA file has been imported for this policy.'
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                claims.data.items.map((claim) => (
                  <TableRow key={claim.id}>
                    <TableCell>
                      <button
                        type="button"
                        className="rounded-sm font-medium text-accent-strong underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => setOpenId(claim.id)}
                      >
                        {claim.tpaClaimId}
                      </button>
                      <span className="block text-xs text-muted-foreground">
                        {TPA_REQUEST_TYPE_LABELS[claim.requestType]}
                        {claim.parentClaimId ? ` of ${claim.parentClaimId}` : ''}
                      </span>
                    </TableCell>
                    <TableCell>
                      {claim.member.name ?? '—'}
                      <span className="block text-xs text-muted-foreground">
                        {claim.member.employeeId ?? 'No employee ID'}
                        {claim.member.relationship
                          ? ` · ${GHI_RELATIONSHIP_LABELS[claim.member.relationship]}`
                          : ''}
                        {claim.member.match !== 'MATCHED'
                          ? ` · ${MATCH_LABEL[claim.member.match]}`
                          : ''}
                      </span>
                    </TableCell>
                    <TableCell className="tabular">
                      {claim.admissionDate ? formatDate(claim.admissionDate) : '—'}
                    </TableCell>
                    <TableCell>
                      {claim.claimType ? CLAIM_TYPE_LABELS[claim.claimType] : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular">{inr(claim.claimedAmount)}</TableCell>
                    <TableCell className="text-right tabular">{inr(claim.settledAmount)}</TableCell>
                    <TableCell>
                      <TpaStatusBadge status={claim.status} source={claim.sourceStatus} />
                    </TableCell>
                    <TableCell>
                      <BoardCell claim={claim} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
      {caseId ? (
        <Pager page={page} pages={pages} total={claims.data?.total ?? 0} onPage={setPage} />
      ) : null}
      <ClaimSheet claimId={openId} onClose={() => setOpenId('')} />
    </div>
  );
}

function BoardCell({ claim }: { claim: TpaClaimRecord }) {
  if (claim.board.claimId)
    return (
      <Link
        className="font-medium text-accent-strong hover:underline"
        href={`/claims/${claim.board.claimId}`}
      >
        {claim.board.claimNumber ?? 'On the board'}
      </Link>
    );
  if (claim.board.state === 'AMBIGUOUS') return <Badge variant="warning">Link by hand</Badge>;
  return claim.boardNote ? (
    <span className="text-xs text-muted-foreground">{claim.boardNote}</span>
  ) : (
    <span className="text-muted-foreground">—</span>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

/**
 * One imported claim, its history, and (for processors) the manual links. Diagnosis details
 * arrive only for users who process claims and the bank account masked unless the user is an
 * Admin: both are decided by the API, never hidden here.
 */
function ClaimSheet({ claimId, onClose }: { claimId: string; onClose: () => void }) {
  const canProcess = usePermission('claims.process');
  const claim = useQuery(tpaClaimQuery(claimId));
  const history = useQuery(tpaClaimHistoryQuery(claimId));
  return (
    <Sheet open={Boolean(claimId)} onOpenChange={(open) => (open ? undefined : onClose())}>
      <SheetContent className="overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{claim.data ? `TPA claim ${claim.data.tpaClaimId}` : 'TPA claim'}</SheetTitle>
          <SheetDescription>
            {claim.data
              ? `${claim.data.tpaCode} · last imported ${formatDateTime(claim.data.importedAt)}`
              : 'Loading…'}
          </SheetDescription>
        </SheetHeader>
        {claim.isError ? (
          <ErrorState error={claim.error} onRetry={() => void claim.refetch()} />
        ) : claim.data ? (
          <div className="grid gap-6 px-4 pb-6">
            <dl className="grid grid-cols-2 gap-3">
              <Fact label="Status">
                <TpaStatusBadge status={claim.data.status} source={claim.data.sourceStatus} />
              </Fact>
              <Fact label="Request">
                {TPA_REQUEST_TYPE_LABELS[claim.data.requestType]}
                {claim.data.parentClaimId ? ` of ${claim.data.parentClaimId}` : ''}
                {claim.data.parent.state === 'NOT_FOUND' ? ' (main claim not imported yet)' : ''}
              </Fact>
              <Fact label="Patient">
                {claim.data.member.name ?? '—'} ({MATCH_LABEL[claim.data.member.match]})
              </Fact>
              <Fact label="Hospital">{claim.data.hospital ?? '—'}</Fact>
              <Fact label="Admitted">
                {claim.data.admissionDate ? formatDate(claim.data.admissionDate) : '—'}
              </Fact>
              <Fact label="Discharged">
                {claim.data.dischargeDate ? formatDate(claim.data.dischargeDate) : '—'}
              </Fact>
              <Fact label="Claimed">{inr(claim.data.claimedAmount)}</Fact>
              <Fact label="Sanctioned">{inr(claim.data.sanctionedAmount)}</Fact>
              <Fact label="Settled">{inr(claim.data.settledAmount)}</Fact>
              <Fact label="Disallowed">{inr(claim.data.disallowedAmount)}</Fact>
              <Fact label="Disease group (ICD-10 chapter)">{claim.data.icdChapter}</Fact>
              <Fact label="Bank account">{claim.data.bankAccount ?? '—'}</Fact>
              {canProcess ? (
                <>
                  <Fact label="Diagnosis">{claim.data.diagnosis ?? '—'}</Fact>
                  <Fact label="ICD code">{claim.data.icdCode ?? '—'}</Fact>
                  <Fact label="Rejection reason">{claim.data.rejectionReason ?? '—'}</Fact>
                </>
              ) : null}
              <Fact label="Claims board">
                <BoardCell claim={claim.data} />
              </Fact>
            </dl>
            {canProcess ? <LinkForm claim={claim.data} /> : null}
            <section className="grid gap-2">
              <h3 className="text-sm font-semibold">History</h3>
              {history.data ? (
                <ol className="grid gap-2 text-sm">
                  {history.data.items.map((item, index) => (
                    <li key={index} className="rounded-md border p-2">
                      <span className="font-medium">
                        {item.type === 'CREATED'
                          ? 'Imported'
                          : item.type === 'UPDATED'
                            ? 'Updated by an import'
                            : item.type === 'LINKED'
                              ? 'Linked'
                              : 'Note'}
                      </span>{' '}
                      <span className="text-muted-foreground">{formatDateTime(item.at)}</span>
                      {item.fromStatus && item.toStatus && item.fromStatus !== item.toStatus ? (
                        <span className="block">
                          {TPA_CLAIM_STATUS_LABELS[item.fromStatus]} →{' '}
                          {TPA_CLAIM_STATUS_LABELS[item.toStatus]}
                        </span>
                      ) : null}
                      {item.changes.length > 0 ? (
                        <ul className="mt-1 text-xs text-muted-foreground">
                          {item.changes.map((change) => (
                            <li key={change.field}>
                              {change.field}: {change.before ?? '—'} → {change.after ?? '—'}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  ))}
                </ol>
              ) : (
                <span className="text-sm text-muted-foreground">Loading…</span>
              )}
            </section>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

/** The review note and the manual board link (N9 8, N11): a person decides what the import could not. */
function LinkForm({ claim }: { claim: TpaClaimRecord }) {
  const [note, setNote] = useState(claim.reviewNote ?? '');
  const [boardClaimId, setBoardClaimId] = useState(claim.board.claimId ?? '');
  const save = useTpaMutation(
    () =>
      apiFetch(`tpa/claims/${claim.id}/link`, {
        method: 'PUT',
        body: {
          reviewNote: note.trim() || null,
          ...(boardClaimId.trim() !== (claim.board.claimId ?? '')
            ? { boardClaimId: boardClaimId.trim() || null }
            : {}),
        },
        schema: TpaClaimRecordSchema,
      }),
    () => ({ title: 'Claim saved' }),
  );
  return (
    <form
      className="grid gap-3 rounded-md border p-3"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate(undefined);
      }}
    >
      <h3 className="text-sm font-semibold">Review</h3>
      <Label className="grid gap-1 text-sm font-normal">
        Note (kept when the claim is imported again)
        <Textarea value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} />
      </Label>
      <Label className="grid gap-1 text-sm font-normal">
        Board claim ID (to link by hand; empty to unlink)
        <Input
          value={boardClaimId}
          placeholder="The board claim’s ID, from its page address"
          onChange={(event) => setBoardClaimId(event.target.value)}
        />
      </Label>
      {save.error ? (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage(save.error)}</AlertDescription>
        </Alert>
      ) : null}
      <div>
        <Button type="submit" disabled={save.isPending}>
          Save
        </Button>
      </div>
    </form>
  );
}
