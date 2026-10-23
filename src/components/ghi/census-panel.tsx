'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { CircleAlert, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog, DownloadButton, Fact, Pager, rupees } from '@/components/ghi/ghi-ui';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  TableLoadingRows,
  errorMessage,
} from '@/components/states';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { usePermission } from '@/hooks/use-permission';
import { toast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api-client';
import {
  ghiCensusIssuesQuery,
  ghiMembersQuery,
  ghiSummaryQuery,
  useGhiMutation,
} from '@/lib/api/ghi';
import {
  GHI_COVERAGE_TYPE_LABELS,
  GHI_GENDER_LABELS,
  GHI_RELATIONSHIPS,
  GHI_RELATIONSHIP_LABELS,
  formatDate,
  type GhiCaseRecord,
  type GhiCensusSummary,
  type GhiMember,
  type GhiRelationship,
} from '@/shared';
import { CensusImport } from './census-import';
import { MemberDialog } from './member-dialog';

/** The census (G3) with its summary (G4), worked out by the API after every change. */
export function CensusPanel({ record }: { record: GhiCaseRecord }) {
  const canEdit = usePermission('gmc.edit');
  const writable = canEdit && !record.locked && record.stage !== 'CLOSED';
  const summary = useQuery(ghiSummaryQuery(record.id));
  const issues = useQuery(ghiCensusIssuesQuery(record.id));
  return (
    <div className="grid gap-6">
      {record.locked ? (
        <Alert variant="info">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>The census is locked</AlertTitle>
          <AlertDescription>
            The RFQ has gone to an insurer with this census. Changes after this are endorsements
            (not handled in the app yet).
          </AlertDescription>
        </Alert>
      ) : null}
      {issues.data && issues.data.items.length > 0 ? (
        <Alert variant="warning">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>{issues.data.items.length} member(s) no longer fit the Data Sheet</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {issues.data.items.slice(0, 10).map((item) => (
                <li key={item.member.id}>
                  {item.member.employeeId} {item.member.name} (
                  {GHI_RELATIONSHIP_LABELS[item.member.relationship]}):{' '}
                  {item.issues.map((issue) => issue.message).join('; ')}
                </li>
              ))}
            </ul>
            Edit or remove them, or change the Data Sheet. The RFQ waits until they fit.
          </AlertDescription>
        </Alert>
      ) : null}
      {summary.isPending ? (
        <LoadingState label="Loading the census summary" />
      ) : summary.isError ? (
        <ErrorState error={summary.error} onRetry={() => void summary.refetch()} />
      ) : (
        <SummaryCard summary={summary.data} />
      )}
      {writable ? <CensusImport record={record} /> : null}
      <MembersCard record={record} writable={writable} />
    </div>
  );
}

function SummaryCard({ summary }: { summary: GhiCensusSummary }) {
  const declaredDiffers =
    summary.declaredEmployees !== null && summary.declaredEmployees !== summary.employees;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Census summary</CardTitle>
        <CardDescription>
          Ages in completed years on {formatDate(summary.ageReferenceDate)}.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
          <Fact label="Employees">{summary.employees}</Fact>
          <Fact label="Insured lives">{summary.lives}</Fact>
          <Fact label="Coverage">
            {summary.coverageType ? GHI_COVERAGE_TYPE_LABELS[summary.coverageType] : 'Not chosen'}
          </Fact>
          <Fact label="Total sum insured">{rupees(summary.totalSumInsured)}</Fact>
          <Fact label="Average age">{summary.averageAge ?? '—'}</Fact>
          <Fact label="Missing sum insured">{summary.missingSumInsured}</Fact>
        </dl>
        {declaredDiffers ? (
          <p className="text-sm text-warning">
            The Data Sheet declares {summary.declaredEmployees} employees; the census has{' '}
            {summary.employees}.
          </p>
        ) : null}
        <div className="grid gap-4 lg:grid-cols-3">
          <SmallTable
            caption="Lives by relationship"
            head={['Relationship', 'Lives']}
            rows={GHI_RELATIONSHIPS.map((key) => [
              GHI_RELATIONSHIP_LABELS[key],
              String(summary.byRelationship[key] ?? 0),
            ])}
          />
          <SmallTable
            caption={
              summary.ageBands
                ? `Lives by age band (${summary.ageBands.name})`
                : 'Lives by age band'
            }
            head={['Age band', 'Lives']}
            rows={[
              ...summary.byAgeBand.map((band) => [band.label, String(band.lives)]),
              // N4: members a chosen set does not cover are counted, never put in a band.
              ...(summary.outsideAgeBands
                ? [['Outside the age bands', String(summary.outsideAgeBands)]]
                : []),
              ...(summary.ageUnknown ? [['Age unknown', String(summary.ageUnknown)]] : []),
            ]}
          />
          <SmallTable
            caption="Sum insured"
            head={['Sum insured', 'Families', 'Lives']}
            rows={summary.bySumInsured.map((item) => [
              rupees(item.sumInsured),
              String(item.families),
              String(item.lives),
            ])}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function SmallTable({
  caption,
  head,
  rows,
}: {
  caption: string;
  head: string[];
  rows: string[][];
}) {
  return (
    <div
      role="region"
      aria-label={caption}
      tabIndex={0}
      className="overflow-x-auto rounded-md border"
    >
      <Table>
        <caption className="px-3 pt-2 text-left text-sm font-medium">{caption}</caption>
        <TableHeader>
          <TableRow>
            {head.map((cell, index) => (
              <TableHead key={cell} className={index > 0 ? 'text-right' : undefined}>
                {cell}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={head.length} className="text-muted-foreground">
                None
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.join('|')}>
                {row.map((cell, index) => (
                  <TableCell key={index} className={index > 0 ? 'text-right tabular' : undefined}>
                    {cell}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function MembersCard({ record, writable }: { record: GhiCaseRecord; writable: boolean }) {
  const [text, setText] = useState('');
  const [relationship, setRelationship] = useState<GhiRelationship | ''>('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<GhiMember | 'new' | null>(null);
  const [removing, setRemoving] = useState<GhiMember | null>(null);
  const q = useDebouncedValue(text, 250);
  const members = useQuery({
    ...ghiMembersQuery(record.id, { q, relationship, page, limit: 25 }),
    placeholderData: keepPreviousData,
  });
  const remove = useGhiMutation(
    record.id,
    (member: GhiMember) =>
      apiFetch(`ghi/cases/${record.id}/members/${member.id}`, { method: 'DELETE' }),
    (_result, member) => ({
      title: 'Member removed',
      description: `${member.name} (${member.employeeId})`,
    }),
  );
  const pages = members.data ? Math.max(1, Math.ceil(members.data.total / members.data.limit)) : 1;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <CardTitle>Employees and family members</CardTitle>
          <CardDescription>
            Families together: the employee first, then spouse, children and parents.
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <DownloadButton path="ghi/census-template" fallbackName="GHI-Census-Template.xlsx">
            Census template
          </DownloadButton>
          {writable ? (
            <Button type="button" onClick={() => setEditing('new')}>
              <Plus aria-hidden="true" />
              Add member
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-60 flex-1">
            <Search
              aria-hidden="true"
              className="absolute top-2.5 left-2.5 size-4 text-muted-foreground"
            />
            <Input
              type="search"
              aria-label="Search by name or employee ID"
              placeholder="Search by name or employee ID"
              className="pl-8"
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <NativeSelect
            aria-label="Relationship"
            className="w-48"
            value={relationship}
            onChange={(event) => {
              setRelationship(event.target.value as GhiRelationship | '');
              setPage(1);
            }}
          >
            <option value="">All relationships</option>
            {GHI_RELATIONSHIPS.map((value) => (
              <option key={value} value={value}>
                {GHI_RELATIONSHIP_LABELS[value]}
              </option>
            ))}
          </NativeSelect>
        </div>
        {remove.isError ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{errorMessage(remove.error)}</AlertDescription>
          </Alert>
        ) : null}
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
                  <TableHead>Date of joining</TableHead>
                  <TableHead className="text-right">Sum insured</TableHead>
                  {writable ? (
                    <TableHead>
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.isPending ? (
                  <TableLoadingRows columns={writable ? 9 : 8} />
                ) : members.data.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9}>
                      <EmptyState
                        title="No members"
                        description={
                          q || relationship
                            ? 'Nothing matches the search.'
                            : 'Import the census file or add members one by one.'
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
                      <TableCell className="tabular">
                        {member.dateOfJoining ? formatDate(member.dateOfJoining) : '—'}
                      </TableCell>
                      <TableCell className="text-right tabular">
                        {member.sumInsured
                          ? rupees(member.sumInsured)
                          : record.requirements.coverageType === 'FLOATER' &&
                              member.relationship !== 'SELF'
                            ? 'Family'
                            : '—'}
                      </TableCell>
                      {writable ? (
                        <TableCell>
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
                              disabled={remove.isPending}
                              onClick={() => setRemoving(member)}
                            >
                              <Trash2 aria-hidden="true" />
                            </Button>
                          </div>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
        <Pager page={page} pages={pages} total={members.data?.total ?? 0} onPage={setPage} />
      </CardContent>
      <ConfirmDialog
        open={removing !== null}
        title="Remove this member?"
        description={
          removing
            ? `${removing.name} (${GHI_RELATIONSHIP_LABELS[removing.relationship]}, ${removing.employeeId}) leaves the census. An employee with dependants cannot be removed before them.`
            : ''
        }
        confirmLabel="Remove"
        pending={remove.isPending}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
        onConfirm={() => {
          if (removing) remove.mutate(removing, { onSettled: () => setRemoving(null) });
        }}
      />
      {editing ? (
        <MemberDialog
          record={record}
          member={editing === 'new' ? null : editing}
          onClose={(saved) => {
            setEditing(null);
            if (saved)
              toast({
                title: editing === 'new' ? 'Member added' : 'Member saved',
                description: `${saved.name} (${saved.employeeId})`,
                variant: 'success',
              });
          }}
        />
      ) : null}
    </Card>
  );
}
