'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleAlert, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog, Fact, Pager, rupees } from '@/components/ghi/ghi-ui';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  TableLoadingRows,
  errorMessage,
} from '@/components/states';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { usePermission } from '@/hooks/use-permission';
import { toast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api-client';
import { caseApi, refreshGhiCase } from '@/lib/api/ghi';
import { ebIssuesQuery, ebMembersQuery, ebSummaryQuery } from '@/lib/eb/api';
import {
  casePermission,
  formatDate,
  GHI_GENDER_LABELS,
  GHI_RELATIONSHIP_LABELS,
  nomineeText,
  type EbCaseRecord,
  type EbMember,
} from '@/shared';
import { z } from 'zod';
import { EbCensusImport } from './eb-census-import';
import { EbMemberDialog } from './eb-member-dialog';
import { TemplateDownloadDialog } from './template-download-dialog';

/**
 * The census of a GPA or GTLI case (Requirements 18 to 23): its summary (with GTLI's members
 * above the free cover limit), the families that do not meet a slot's minimum, the members, the
 * template download and the import. Nothing can be added without a plan (18.10).
 */
export function EbCensusPanel({ record }: { record: EbCaseRecord }) {
  const canEdit = usePermission(casePermission(record.product, 'edit'));
  const editable =
    canEdit &&
    !record.locked &&
    !record.placed &&
    record.stage !== 'CLOSED' &&
    Boolean(record.plan);
  const summary = useQuery(ebSummaryQuery(record.product, record.id));
  const issues = useQuery(ebIssuesQuery(record.product, record.id));
  return (
    <div className="grid gap-6">
      {!record.plan ? (
        <Alert variant="warning">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>Assign a family plan first</AlertTitle>
          <AlertDescription>
            The census is checked against the case’s plan; upload and entry wait for it.
          </AlertDescription>
        </Alert>
      ) : null}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            <CardTitle>Census summary</CardTitle>
            <CardDescription>Every member at the sum insured that covers them.</CardDescription>
          </div>
          <TemplateDownloadDialog
            product={record.product}
            caseId={record.id}
            casePlanId={record.plan?.planId ?? null}
          />
        </CardHeader>
        <CardContent>
          {summary.isPending ? (
            <LoadingState label="Loading the summary" />
          ) : summary.isError ? (
            <ErrorState error={summary.error} onRetry={() => void summary.refetch()} />
          ) : (
            <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <Fact label="Employees">{summary.data.employees}</Fact>
              <Fact label="Lives">{summary.data.lives}</Fact>
              <Fact label="Total sum insured">{rupees(summary.data.totalSumInsured)}</Fact>
              <Fact label="Average age">{summary.data.averageAge ?? '—'}</Fact>
              {record.product === 'GTLI' && summary.data.freeCoverLimit ? (
                <Fact label={`Above the free cover limit (${rupees(summary.data.freeCoverLimit)})`}>
                  {summary.data.aboveFreeCoverLimit ?? 0}
                </Fact>
              ) : null}
            </dl>
          )}
        </CardContent>
      </Card>
      {issues.data && (issues.data.items.length > 0 || issues.data.shortfalls.length > 0) ? (
        <Alert variant="warning">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>Census problems to correct before the RFQ</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {issues.data.items.map((item) => (
                <li key={item.member.id}>
                  {item.member.employeeId} {item.member.name}:{' '}
                  {item.issues.map((issue) => issue.message).join('; ')}
                </li>
              ))}
              {issues.data.shortfalls.map((shortfall) => (
                <li key={`${shortfall.employeeKey}-${shortfall.slot}`}>{shortfall.message}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}
      {editable ? <EbCensusImport record={record} /> : null}
      <Members record={record} editable={editable} />
    </div>
  );
}

function Members({ record, editable }: { record: EbCaseRecord; editable: boolean }) {
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<EbMember | 'new' | null>(null);
  const [removing, setRemoving] = useState<EbMember | null>(null);
  const q = useDebouncedValue(text, 250);
  const members = useQuery({
    ...ebMembersQuery(record.product, record.id, { q, relationship: '', page, limit: 50 }),
    placeholderData: keepPreviousData,
  });
  // The census for feedback while typing (the API checks the whole census again).
  const census = useQuery(
    ebMembersQuery(record.product, record.id, { q: '', relationship: '', page: 1, limit: 200 }),
  );
  const remove = useMutation({
    mutationFn: (member: EbMember) =>
      apiFetch(`${caseApi(record.product, record.id)}/members/${member.id}`, {
        method: 'DELETE',
        schema: z.unknown(),
      }),
    onSuccess: () => {
      refreshGhiCase(queryClient, record.id);
      setRemoving(null);
      toast({ title: 'Member removed', variant: 'success' });
    },
  });
  const salary = record.requirements.sumInsuredBasis?.kind === 'SALARY_MULTIPLE';
  const pages = members.data ? Math.max(1, Math.ceil(members.data.total / members.data.limit)) : 1;
  const monthly = members.data?.items.some((member) => member.monthlySalary !== null) ?? false;
  const columns = (salary ? 10 : 9) + (monthly ? 1 : 0) + 1;
  const cover = record.product === 'GTLI' ? 'Sum assured' : 'Sum insured';
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <CardTitle>Members</CardTitle>
          <CardDescription>
            Families together: the employee first, then the dependants.
          </CardDescription>
        </div>
        {editable ? (
          <Button type="button" onClick={() => setEditing('new')}>
            <Plus aria-hidden="true" />
            Add member
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="grid gap-3">
        <Input
          type="search"
          aria-label="Search the census by name or employee ID"
          placeholder="Search by name or employee ID"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setPage(1);
          }}
        />
        {members.isError ? (
          <ErrorState error={members.error} onRetry={() => void members.refetch()} />
        ) : (
          <div
            role="region"
            aria-label="Census members"
            tabIndex={0}
            className="overflow-x-auto rounded-md border"
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Relationship</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead>Date of birth</TableHead>
                  <TableHead className="text-right">Age</TableHead>
                  {monthly ? <TableHead className="text-right">Monthly salary</TableHead> : null}
                  {salary ? <TableHead className="text-right">Annual salary</TableHead> : null}
                  <TableHead className="text-right">{cover}</TableHead>
                  <TableHead>Nominee</TableHead>
                  <TableHead>Identity</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.isPending ? (
                  <TableLoadingRows columns={columns} />
                ) : members.data.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columns + 1}>
                      <EmptyState
                        title="No member yet"
                        description={
                          editable
                            ? 'Upload the census from the template, or add members by hand.'
                            : 'Nothing to show.'
                        }
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  members.data.items.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="tabular">{member.employeeId}</TableCell>
                      <TableCell>{member.name}</TableCell>
                      <TableCell>{GHI_RELATIONSHIP_LABELS[member.relationship]}</TableCell>
                      <TableCell>{GHI_GENDER_LABELS[member.gender]}</TableCell>
                      <TableCell className="tabular">
                        {member.dateOfBirth ? (
                          formatDate(member.dateOfBirth)
                        ) : (
                          <span className="text-muted-foreground">Hidden</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular">{member.age}</TableCell>
                      {monthly ? (
                        <TableCell className="text-right tabular">
                          {rupees(member.monthlySalary)}
                        </TableCell>
                      ) : null}
                      {salary ? (
                        <TableCell className="text-right tabular">
                          {rupees(member.annualSalary)}
                        </TableCell>
                      ) : null}
                      <TableCell className="text-right">
                        <span className="tabular">{rupees(member.coveredSumInsured)}</span>
                        {member.coverageBasis ? (
                          <span className="block text-xs text-muted-foreground">
                            {member.coverageBasis}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-sm">
                        {member.nominee ? nomineeText(member.nominee, formatDate) : '—'}
                      </TableCell>
                      <TableCell>
                        {member.relationship === 'SELF' ? (
                          member.employeeIdentityId ? (
                            <Badge variant="muted">Linked</Badge>
                          ) : (
                            <Badge variant="warning">Unresolved</Badge>
                          )
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {editable ? (
                          <div className="flex gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={`Edit ${member.name}`}
                              onClick={() => setEditing(member)}
                            >
                              <Pencil aria-hidden="true" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={`Remove ${member.name}`}
                              onClick={() => setRemoving(member)}
                            >
                              <Trash2 aria-hidden="true" />
                            </Button>
                          </div>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
        <Pager page={page} pages={pages} total={members.data?.total ?? 0} onPage={setPage} />
        {remove.isError ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{errorMessage(remove.error)}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
      {editing ? (
        <EbMemberDialog
          record={record}
          member={editing === 'new' ? null : editing}
          census={census.data?.items ?? []}
          onClose={() => setEditing(null)}
        />
      ) : null}
      <ConfirmDialog
        open={removing !== null}
        title={`Remove ${removing?.name ?? ''}?`}
        description="The member leaves this case’s census. An employee with dependants cannot be removed before them."
        confirmLabel="Remove"
        pending={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing)}
        onOpenChange={(open) => (open ? undefined : setRemoving(null))}
      />
    </Card>
  );
}
