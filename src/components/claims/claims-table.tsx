'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { Pager } from '@/components/ghi/ghi-ui';
import { EmptyState, ErrorState, TableLoadingRows } from '@/components/states';
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
import { claimListQuery, type ClaimFilters } from '@/lib/api/claims';
import {
  CLAIM_STATUSES,
  CLAIM_STATUS_LABELS,
  CLAIM_TYPE_LABELS,
  GHI_RELATIONSHIP_LABELS,
  formatDate,
  type ClaimStatus,
} from '@/shared';
import { ClaimStatusBadge, daysText, inr } from './claim-ui';

/** The claims table (C1): search and company from the page, plus status and date filters, paged. */
export function ClaimsTable({ q, clientId }: { q: string; clientId: string }) {
  const [status, setStatus] = useState<ClaimStatus | ''>('');
  const [dateField, setDateField] = useState<'CREATED' | 'ADMISSION'>('CREATED');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const filters: ClaimFilters = { q, clientId, status, dateField, from, to, page };
  const claims = useQuery({ ...claimListQuery(filters), placeholderData: keepPreviousData });
  const pages = claims.data ? Math.max(1, Math.ceil(claims.data.total / claims.data.limit)) : 1;
  const reset =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value);
      setPage(1);
    };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <Label className="grid gap-1 text-sm font-normal">
          Status
          <NativeSelect
            className="w-44"
            value={status}
            onChange={(event) => reset(setStatus)(event.target.value as ClaimStatus | '')}
          >
            <option value="">All statuses</option>
            {CLAIM_STATUSES.map((value) => (
              <option key={value} value={value}>
                {CLAIM_STATUS_LABELS[value]}
              </option>
            ))}
          </NativeSelect>
        </Label>
        <Label className="grid gap-1 text-sm font-normal">
          Date of
          <NativeSelect
            className="w-40"
            value={dateField}
            onChange={(event) => reset(setDateField)(event.target.value as 'CREATED' | 'ADMISSION')}
          >
            <option value="CREATED">Claim made</option>
            <option value="ADMISSION">Admission</option>
          </NativeSelect>
        </Label>
        <Label className="grid gap-1 text-sm font-normal">
          From
          <Input
            type="date"
            className="w-40"
            value={from}
            onChange={(event) => reset(setFrom)(event.target.value)}
          />
        </Label>
        <Label className="grid gap-1 text-sm font-normal">
          To
          <Input
            type="date"
            className="w-40"
            value={to}
            onChange={(event) => reset(setTo)(event.target.value)}
          />
        </Label>
      </div>
      {claims.isError ? (
        <ErrorState error={claims.error} onRetry={() => void claims.refetch()} />
      ) : (
        <div
          role="region"
          aria-label="Claims"
          tabIndex={0}
          className="overflow-x-auto rounded-md border"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Claim</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Hospital</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Admitted</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>In stage</TableHead>
                <TableHead>Assigned to</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {claims.isPending ? (
                <TableLoadingRows columns={11} />
              ) : claims.data.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11}>
                    <EmptyState
                      title="No claims"
                      description="Nothing matches the search and filters."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                claims.data.items.map((claim) => (
                  <TableRow key={claim.id}>
                    <TableCell>
                      <Link
                        className="font-medium text-accent-strong hover:underline"
                        href={`/claims/${claim.id}`}
                      >
                        {claim.claimNumber}
                      </Link>
                    </TableCell>
                    <TableCell>{claim.clientName}</TableCell>
                    <TableCell>{claim.employeeName}</TableCell>
                    <TableCell>
                      {claim.patientName}
                      <span className="block text-xs text-muted-foreground">
                        {GHI_RELATIONSHIP_LABELS[claim.relationship]}
                      </span>
                    </TableCell>
                    <TableCell>{claim.hospital}</TableCell>
                    <TableCell>{CLAIM_TYPE_LABELS[claim.claimType]}</TableCell>
                    <TableCell className="tabular">{formatDate(claim.admissionDate)}</TableCell>
                    <TableCell className="text-right tabular">{inr(claim.amountClaimed)}</TableCell>
                    <TableCell>
                      <ClaimStatusBadge status={claim.status} />
                    </TableCell>
                    <TableCell className="tabular">{daysText(claim.daysInStage)}</TableCell>
                    <TableCell>{claim.assignedTo?.name ?? '—'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
      <Pager page={page} pages={pages} total={claims.data?.total ?? 0} onPage={setPage} />
    </div>
  );
}
