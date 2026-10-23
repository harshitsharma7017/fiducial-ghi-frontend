'use client';

import { useQuery } from '@tanstack/react-query';
import { CircleCheck, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { CaseActions } from '@/components/ghi/case-actions';
import { Fact, GhiStageBadge, GhiStageStepper } from '@/components/ghi/ghi-ui';
import { PaymentsPanel } from '@/components/ghi/payments-panel';
import { RfqPanel } from '@/components/ghi/rfq-panel';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePermission } from '@/hooks/use-permission';
import { ApiError } from '@/lib/api-client';
import { ebCaseQuery } from '@/lib/eb/api';
import {
  casePermission,
  EB_PRODUCT_LABELS,
  EB_PRODUCT_SLUGS,
  EB_STAGES,
  formatDate,
  formatDateTime,
  GHI_CASE_TYPE_LABELS,
  type EbCaseRecord,
  type EbRoutedProduct,
  type EbStage,
} from '@/shared';
import { EbCensusPanel } from './eb-census-panel';
import { EbPlacementPanel } from './eb-placement-panel';
import { EbQcrPanel } from './eb-qcr-panel';
import { EbQuotesPanel } from './eb-quotes-panel';
import { EbRequirementsForm } from './eb-requirements-form';
import { AgeBandsCard } from './age-bands-card';
import { PlanCard } from './plan-card';

// A GPA or GTLI case (Requirement 2.4): the product's own stages and tabs only, with no Final
// QCR or policy step; the client's decision is on the QCR and approval tab (9.3).

const TABS = [
  { value: 'data-sheet', label: 'Data Sheet', completes: 'DATA_SHEET' },
  { value: 'census', label: 'Plan and census', completes: 'RFQ' },
  { value: 'rfq', label: 'Insurers and RFQ', completes: 'QCR' },
  { value: 'quotes', label: 'Quotes', completes: 'QCR' },
  { value: 'qcr', label: 'QCR and approval', completes: 'PAYMENT' },
  { value: 'payment', label: 'Payment', completes: 'PLACEMENT_SLIP' },
  { value: 'placement', label: 'Placement slip', completes: null },
  { value: 'activity', label: 'Activity', completes: null },
] as const satisfies readonly { value: string; label: string; completes: EbStage | null }[];
type Tab = (typeof TABS)[number]['value'];

const STAGE_TAB: Record<EbStage, Tab> = {
  CREATED: 'data-sheet',
  DATA_SHEET: 'data-sheet',
  RFQ: 'rfq',
  QCR: 'qcr',
  APPROVAL: 'qcr',
  PAYMENT: 'payment',
  PLACEMENT_SLIP: 'placement',
  CLOSED: 'activity',
};

function nextTab(record: EbCaseRecord): Tab {
  if (record.stage === 'DATA_SHEET' && record.missingItems.length === 0) return 'census';
  if (record.stage === 'RFQ' && record.locked) return 'quotes';
  return STAGE_TAB[record.stage];
}

export function EbWorkspace({
  product,
  id,
  initialTab,
}: {
  product: EbRoutedProduct;
  id: string;
  initialTab?: string;
}) {
  const query = useQuery(ebCaseQuery(product, id));
  if (query.isPending) return <LoadingState label="Loading the case" className="max-w-xl" />;
  if (query.isError) {
    if (query.error instanceof ApiError && query.error.status === 404) {
      return (
        <EmptyState
          title="Case not found"
          description={
            <>
              Go back to{' '}
              <Link
                href={`/eb/${EB_PRODUCT_SLUGS[product]}`}
                className="text-accent-strong hover:underline"
              >
                {EB_PRODUCT_LABELS[product]}
              </Link>
              .
            </>
          }
          className="mx-auto max-w-md"
        />
      );
    }
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  }
  return <Loaded record={query.data} initialTab={initialTab} />;
}

function Loaded({ record, initialTab }: { record: EbCaseRecord; initialTab?: string }) {
  const canEdit = usePermission(casePermission(record.product, 'edit'));
  const [tab, setTab] = useState<string>(
    () => TABS.find((item) => item.value === initialTab)?.value ?? nextTab(record),
  );
  const reached = EB_STAGES.indexOf(record.stage);
  const done = (completes: EbStage | null) =>
    record.stage !== 'CLOSED' &&
    completes !== null &&
    (record.placed || reached >= EB_STAGES.indexOf(completes));
  const sent = record.insurers.filter((insurer) => insurer.status !== 'NOT_SENT').length;
  const editable = record.stage !== 'CLOSED' && !record.locked && !record.placed;
  return (
    <>
      <div className="mb-6 grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight text-primary">
            {record.client.name}
          </h1>
          <Badge variant="accent">{EB_PRODUCT_LABELS[record.product]}</Badge>
          <Badge variant={record.type === 'RENEWAL' ? 'accent' : 'default'}>
            {GHI_CASE_TYPE_LABELS[record.type]}
          </Badge>
          <GhiStageBadge stage={record.stage} type={record.type} placed={record.placed} />
        </div>
        <p className="text-sm text-muted-foreground tabular">
          {record.reference} · {record.client.city || record.client.state} ·{' '}
          {record.client.gstin ?? 'No GSTIN'} · Assigned to {record.owner.name}
        </p>
        {record.nextStep ? <p className="text-sm">{record.nextStep}</p> : null}
      </div>
      {record.stage === 'CLOSED' ? (
        <Alert variant="info" className="mb-6">
          <XCircle aria-hidden="true" />
          <AlertTitle>This case is closed</AlertTitle>
          <AlertDescription>{record.closedReason}</AlertDescription>
        </Alert>
      ) : null}
      {record.placed && record.placement ? (
        <Alert variant="success" className="mb-6">
          <CircleCheck aria-hidden="true" />
          <AlertTitle>
            Placed{record.placement.policyNumber ? `: policy ${record.placement.policyNumber}` : ''}
          </AlertTitle>
          <AlertDescription>
            Placement slip issued by {record.placement.issuedBy},{' '}
            {formatDateTime(record.placement.issuedAt)}.
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="mb-6 grid gap-4 *:min-w-0 lg:grid-cols-[1fr_auto]">
        <div className="grid gap-3">
          <GhiStageStepper
            stage={record.stage}
            stages={EB_STAGES}
            type={record.type}
            placed={record.placed}
            onSelect={(stage) => setTab(STAGE_TAB[stage as EbStage])}
          />
          {canEdit ? <CaseActions record={record} /> : null}
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4 lg:grid-cols-2">
          <Fact label="Policy period">
            {record.policyStart
              ? `${formatDate(record.policyStart)} – ${record.policyEnd ? formatDate(record.policyEnd) : '1 year'}`
              : '1 year from payment'}
          </Fact>
          <Fact label="Quotes needed by">{formatDate(record.dueDate)}</Fact>
          <Fact label="Ages on">{formatDate(record.ageReferenceDate)}</Fact>
          <Fact label="RFQ sent to">
            {sent} of {record.insurers.length} insurers
          </Fact>
        </dl>
      </div>
      <Tabs value={tab} onValueChange={setTab} className="gap-6">
        <TabsList className="flex-wrap">
          {TABS.map((item) => (
            <TabsTrigger key={item.value} value={item.value}>
              {done(item.completes) ? (
                <CircleCheck aria-hidden="true" className="size-3.5 text-success" />
              ) : null}
              {item.label}
              {done(item.completes) ? <span className="sr-only">, done</span> : null}
              {item.value === 'data-sheet' && editable && record.missingItems.length > 0 ? (
                <Badge variant="warning" className="ml-1 tabular">
                  {record.missingItems.length}
                  <span className="sr-only"> items needed</span>
                </Badge>
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="data-sheet" forceMount className="min-w-0 data-[state=inactive]:hidden">
          <EbRequirementsForm record={record} />
        </TabsContent>
        <TabsContent value="census" className="grid min-w-0 gap-6">
          <PlanCard
            caseId={record.id}
            product={record.product}
            plan={record.plan}
            editable={editable}
          />
          <AgeBandsCard
            caseId={record.id}
            product={record.product}
            selection={record.ageBands ?? null}
            editable={editable}
          />
          <EbCensusPanel record={record} />
        </TabsContent>
        <TabsContent value="rfq" className="min-w-0">
          <RfqPanel record={record} />
        </TabsContent>
        <TabsContent value="quotes" className="min-w-0">
          <EbQuotesPanel record={record} />
        </TabsContent>
        <TabsContent value="qcr" className="min-w-0">
          <EbQcrPanel record={record} />
        </TabsContent>
        <TabsContent value="payment" className="min-w-0">
          <PaymentsPanel record={record} />
        </TabsContent>
        <TabsContent value="placement" className="min-w-0">
          <EbPlacementPanel record={record} />
        </TabsContent>
        <TabsContent value="activity" className="min-w-0">
          <ol className="grid gap-2" aria-label="Activity">
            {record.activity.map((item, index) => (
              <li
                key={`${item.at}-${index}`}
                className="grid gap-0.5 rounded-md border px-3 py-2 text-sm"
              >
                <span>{item.message}</span>
                <span className="text-xs text-muted-foreground tabular">
                  {item.actor} · {formatDateTime(item.at)}
                </span>
              </li>
            ))}
          </ol>
        </TabsContent>
      </Tabs>
    </>
  );
}
