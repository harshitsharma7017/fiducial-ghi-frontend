'use client';

import { useQuery } from '@tanstack/react-query';
import { CircleCheck, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePermission } from '@/hooks/use-permission';
import { ApiError } from '@/lib/api-client';
import { ghiCaseQuery } from '@/lib/api/ghi';
import {
  GHI_CASE_TYPE_LABELS,
  GHI_STAGES,
  formatDate,
  formatDateTime,
  type GhiCaseRecord,
  type GhiStage,
} from '@/shared';
import { AgeBandsCard } from '@/components/eb/age-bands-card';
import { PlanCard } from '@/components/eb/plan-card';
import { TemplateDownloadDialog } from '@/components/eb/template-download-dialog';
import { CaseActions } from './case-actions';
import { CensusPanel } from './census-panel';
import { FinalQcrPanel } from './final-qcr-panel';
import { Fact, GhiStageBadge, GhiStageStepper } from './ghi-ui';
import { PaymentsPanel } from './payments-panel';
import { PlacementPanel } from './placement-panel';
import { QcrPanel } from './qcr-panel';
import { QuotesPanel } from './quotes-panel';
import { RequirementsForm } from './requirements-form';
import { RfqPanel } from './rfq-panel';

const TABS = [
  { value: 'data-sheet', label: 'Data Sheet', completes: 'DATA_SHEET' },
  { value: 'census', label: 'Census', completes: 'RFQ' },
  { value: 'rfq', label: 'RFQ', completes: 'QCR' },
  { value: 'quotes', label: 'Quotes', completes: 'QCR' },
  { value: 'qcr', label: 'QCR and approval', completes: 'FINAL_QCR' },
  { value: 'final', label: 'Final QCR', completes: 'PAYMENT' },
  { value: 'payment', label: 'Payment', completes: 'PLACEMENT_SLIP' },
  { value: 'placement', label: 'Placement and policy', completes: null },
  { value: 'activity', label: 'Activity', completes: null },
] as const satisfies readonly { value: string; label: string; completes: GhiStage | null }[];
type Tab = (typeof TABS)[number]['value'];

/** Where each stage's work is done: a step of the stepper opens this tab. */
const STAGE_TAB: Record<GhiStage, Tab> = {
  CREATED: 'data-sheet',
  DATA_SHEET: 'data-sheet',
  RFQ: 'rfq',
  QCR: 'qcr',
  APPROVAL: 'qcr',
  FINAL_QCR: 'final',
  PAYMENT: 'payment',
  PLACEMENT_SLIP: 'placement',
  CLOSED: 'activity',
};

/** Where a case at this stage goes on next. */
function nextTab(record: GhiCaseRecord): Tab {
  if (record.stage === 'DATA_SHEET' && record.missing.length === 0) return 'census';
  if (record.stage === 'RFQ' && record.locked) return 'quotes';
  return STAGE_TAB[record.stage];
}

/** A group health case, worked from the Data Sheet to the policy (G1 to G7). */
export function GhiWorkspace({ id, initialTab }: { id: string; initialTab?: string }) {
  const query = useQuery(ghiCaseQuery(id));
  if (query.isPending) return <LoadingState label="Loading the case" className="max-w-xl" />;
  if (query.isError) {
    if (query.error instanceof ApiError && query.error.status === 404) {
      return (
        <EmptyState
          title="Case not found"
          description={
            <>
              Go back to{' '}
              <Link href="/ghi" className="text-accent-strong hover:underline">
                Group Health
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

function Loaded({ record, initialTab }: { record: GhiCaseRecord; initialTab?: string }) {
  const canEdit = usePermission('proposals.edit');
  const [tab, setTab] = useState<string>(
    () => TABS.find((item) => item.value === initialTab)?.value ?? nextTab(record),
  );
  const reached = GHI_STAGES.indexOf(record.stage);
  const done = (completes: GhiStage | null) =>
    record.stage !== 'CLOSED' && completes !== null && reached >= GHI_STAGES.indexOf(completes);
  const sent = record.insurers.filter((insurer) => insurer.status !== 'NOT_SENT').length;

  return (
    <>
      <div className="mb-6 grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight text-primary">
            {record.client.name}
          </h1>
          <Badge variant="accent">Group Health</Badge>
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
      {record.placed && record.policy ? (
        <Alert variant="success" className="mb-6">
          <CircleCheck aria-hidden="true" />
          <AlertTitle>Placed: policy {record.policy.policyNumber}</AlertTitle>
          <AlertDescription>
            {record.policy.insurerName}, {formatDate(record.policy.policyStart)} to{' '}
            {formatDate(record.policy.policyEnd)}. Renewal due{' '}
            {formatDate(record.policy.renewalDate)}.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="mb-6 grid gap-4 *:min-w-0 lg:grid-cols-[1fr_auto]">
        <div className="grid gap-3">
          <GhiStageStepper
            stage={record.stage}
            type={record.type}
            placed={record.placed}
            onSelect={(stage) => setTab(STAGE_TAB[stage])}
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
              {item.value === 'data-sheet' && !record.locked && record.missing.length > 0 ? (
                <Badge variant="warning" className="ml-1 tabular">
                  {record.missing.length}
                  <span className="sr-only"> items needed</span>
                </Badge>
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>
        {/* Mounted while hidden, so unsaved Data Sheet entries survive a look at another tab. */}
        <TabsContent value="data-sheet" forceMount className="min-w-0 data-[state=inactive]:hidden">
          <RequirementsForm record={record} />
        </TabsContent>
        <TabsContent value="census" className="grid min-w-0 gap-6">
          <PlanCard
            caseId={record.id}
            product="GMC"
            plan={record.plan}
            editable={record.stage !== 'CLOSED' && !record.locked && !record.placed}
          />
          <AgeBandsCard
            caseId={record.id}
            product="GMC"
            selection={record.ageBands ?? null}
            editable={
              record.stage !== 'CLOSED' && !record.locked && !record.placed && !record.policy
            }
          />
          <div>
            <TemplateDownloadDialog
              product="GMC"
              caseId={record.id}
              casePlanId={record.plan?.planId ?? null}
            />
          </div>
          <CensusPanel record={record} />
        </TabsContent>
        <TabsContent value="rfq" className="min-w-0">
          <RfqPanel record={record} />
        </TabsContent>
        <TabsContent value="quotes" className="min-w-0">
          <QuotesPanel record={record} />
        </TabsContent>
        <TabsContent value="qcr" className="min-w-0">
          <QcrPanel record={record} />
        </TabsContent>
        <TabsContent value="final" className="min-w-0">
          <FinalQcrPanel record={record} />
        </TabsContent>
        <TabsContent value="payment" className="min-w-0">
          <PaymentsPanel record={record} />
        </TabsContent>
        <TabsContent value="placement" className="min-w-0">
          <PlacementPanel record={record} />
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
