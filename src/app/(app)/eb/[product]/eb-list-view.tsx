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
import { ebCasesQuery, type EbListFilters } from '@/lib/eb/api';
import {
  casePermission,
  EB_PRODUCT_LABELS,
  EB_STAGES,
  ebCasePath,
  formatDate,
  GHI_CASE_TYPE_LABELS,
  GHI_CASE_TYPES,
  GHI_STAGE_LABELS,
  type EbRoutedProduct,
  type GhiCaseType,
  type GhiStage,
} from '@/shared';

const DESCRIPTION: Record<EbRoutedProduct, string> = {
  GPA: 'Group personal accident cases: Data Sheet, family plan, census, RFQ, quotes, QCR, the client’s decision, payment and the placement slip.',
  GTLI: 'Group term life cases: Data Sheet, family plan, census, RFQ, quotes, QCR, the client’s decision, payment and the placement slip.',
};

/** The cases of one product, most recently changed first (Requirement 2.3). */
export function EbListView({ product }: { product: EbRoutedProduct }) {
  const canCreate = usePermission(casePermission(product, 'create'));
  return (
    <>
      <PageHeader
        title={EB_PRODUCT_LABELS[product]}
        description={DESCRIPTION[product]}
        actions={
          canCreate ? (
            <Button asChild>
              <Link href={`/ghi/new?product=${product}`}>
                <Plus aria-hidden="true" />
                New case
              </Link>
            </Button>
          ) : null
        }
      />
      <DemoModeGate>
        <CaseList product={product} />
      </DemoModeGate>
    </>
  );
}

function CaseList({ product }: { product: EbRoutedProduct }) {
  const [text, setText] = useState('');
  const [stage, setStage] = useState<GhiStage | ''>('');
  const [type, setType] = useState<GhiCaseType | ''>('');
  const [page, setPage] = useState(1);
  const q = useDebouncedValue(text, 250);
  const filters: EbListFilters = { q, stage, type, page };
  const cases = useQuery({ ...ebCasesQuery(product, filters), placeholderData: keepPreviousData });
  const pages = cases.data ? Math.max(1, Math.ceil(cases.data.total / cases.data.limit)) : 1;
  const reset = () => setPage(1);
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
              maxLength={100}
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                reset();
              }}
            />
          </div>
          <NativeSelect
            aria-label="Stage"
            className="w-48"
            value={stage}
            onChange={(event) => {
              setStage(event.target.value as GhiStage | '');
              reset();
            }}
          >
            <option value="">All stages</option>
            {EB_STAGES.map((value) => (
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
              reset();
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
            aria-label={`${product} cases`}
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
                        title={`No ${product} case`}
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
                          href={ebCasePath(item.product, item.id)}
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
