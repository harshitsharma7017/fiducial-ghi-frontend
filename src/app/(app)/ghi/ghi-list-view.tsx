'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { DemoModeGate } from '@/components/demo-mode-gate';
import { GhiStageBadge, Pager } from '@/components/ghi/ghi-ui';
import { PageHeader } from '@/components/page-header';
import { EmptyState, ErrorState, TableLoadingRows } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { ghiCasesQuery, type GhiListFilters } from '@/lib/api/ghi';
import {
  GHI_CASE_TYPES,
  GHI_CASE_TYPE_LABELS,
  GHI_STAGES,
  GHI_STAGE_LABELS,
  formatDate,
  type GhiCaseType,
  type GhiStage,
} from '@/shared';

/** Every group health case, most recently changed first, searchable by reference or company. */
export function GhiListView() {
  const canCreate = usePermission('proposals.create');
  return (
    <>
      <PageHeader
        title="Group Health"
        description="Group health insurance cases: Data Sheet, employee census, RFQ, quotes, QCR, payment and placement."
        actions={
          canCreate ? (
            <Button asChild>
              <Link href="/ghi/new">
                <Plus aria-hidden="true" />
                New case
              </Link>
            </Button>
          ) : null
        }
      />
      <DemoModeGate>
        <CaseList />
      </DemoModeGate>
    </>
  );
}

function CaseList() {
  const [text, setText] = useState('');
  const [stage, setStage] = useState<GhiStage | ''>('');
  const [type, setType] = useState<GhiCaseType | ''>('');
  const [page, setPage] = useState(1);
  const q = useDebouncedValue(text, 250);
  const filters: GhiListFilters = { q, stage, type, page };
  const cases = useQuery({ ...ghiCasesQuery(filters), placeholderData: keepPreviousData });
  const pages = cases.data ? Math.max(1, Math.ceil(cases.data.total / cases.data.limit)) : 1;

  return (
    <Card>
      <CardContent className="grid gap-4 pt-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative min-w-60 flex-1">
            <Search
              aria-hidden="true"
              className="absolute top-2.5 left-2.5 size-4 text-muted-foreground"
            />
            <Input
              type="search"
              aria-label="Search by reference or company"
              placeholder="Search by reference or company"
              className="pl-8"
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <NativeSelect
            aria-label="Stage"
            className="w-48"
            value={stage}
            onChange={(event) => {
              setStage(event.target.value as GhiStage | '');
              setPage(1);
            }}
          >
            <option value="">All stages</option>
            {GHI_STAGES.map((value) => (
              <option key={value} value={value}>
                {GHI_STAGE_LABELS[value]}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect
            aria-label="Type"
            className="w-40"
            value={type}
            onChange={(event) => {
              setType(event.target.value as GhiCaseType | '');
              setPage(1);
            }}
          >
            <option value="">All types</option>
            {GHI_CASE_TYPES.map((value) => (
              <option key={value} value={value}>
                {GHI_CASE_TYPE_LABELS[value]}
              </option>
            ))}
          </NativeSelect>
        </div>

        {cases.isError ? (
          <ErrorState error={cases.error} onRetry={() => void cases.refetch()} />
        ) : (
          <div
            role="region"
            aria-label="Group health cases"
            tabIndex={0}
            className="overflow-x-auto rounded-md border"
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead className="text-right">Employees</TableHead>
                  <TableHead className="text-right">Lives</TableHead>
                  <TableHead>Policy starts</TableHead>
                  <TableHead>Quotes by</TableHead>
                  <TableHead>Assigned to</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cases.isPending ? (
                  <TableLoadingRows columns={9} />
                ) : cases.data.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9}>
                      <EmptyState
                        title="No group health case"
                        description={
                          q || stage || type
                            ? 'Nothing matches the search.'
                            : 'Start one with New case.'
                        }
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  cases.data.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Link
                          className="font-medium text-accent-strong hover:underline"
                          href={`/ghi/${item.id}`}
                        >
                          {item.reference}
                        </Link>
                      </TableCell>
                      <TableCell>{item.client.name}</TableCell>
                      <TableCell>{GHI_CASE_TYPE_LABELS[item.type]}</TableCell>
                      <TableCell>
                        <GhiStageBadge stage={item.stage} type={item.type} placed={item.placed} />
                      </TableCell>
                      <TableCell className="text-right tabular">{item.employees}</TableCell>
                      <TableCell className="text-right tabular">{item.lives}</TableCell>
                      <TableCell className="tabular">
                        {item.policyStart ? formatDate(item.policyStart) : '—'}
                      </TableCell>
                      <TableCell className="tabular">{formatDate(item.dueDate)}</TableCell>
                      <TableCell>{item.owner}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
        <Pager page={page} pages={pages} total={cases.data?.total ?? 0} onPage={setPage} />
      </CardContent>
    </Card>
  );
}
