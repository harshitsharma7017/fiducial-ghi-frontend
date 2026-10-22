'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CircleAlert, Pencil, UserCog } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Fact } from '@/components/ghi/ghi-ui';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePermission } from '@/hooks/use-permission';
import { ApiError } from '@/lib/api-client';
import { claimQuery } from '@/lib/api/claims';
import {
  CLAIM_DOCUMENT_KIND_LABELS,
  CLAIM_STATUS_LABELS,
  CLAIM_TYPE_LABELS,
  GHI_RELATIONSHIP_LABELS,
  formatDate,
  formatDateTime,
  type ClaimDetail,
} from '@/shared';
import { AssignDialog, EditClaimDialog } from './claim-dialogs';
import { ClaimDocuments, ClaimEmails, ClaimRemarks, ClaimTimeline } from './claim-sections';
import { ClaimStatusBadge, MoveDialog, daysText, inr, type PendingMove } from './claim-ui';

/** A claim in full (C4): details, documents, remarks, emails and the timeline of every event. */
export function ClaimDetailView({ id }: { id: string }) {
  const query = useQuery(claimQuery(id));
  if (query.isPending) return <LoadingState label="Loading the claim" className="max-w-xl" />;
  if (query.isError) {
    if (query.error instanceof ApiError && query.error.status === 404) {
      return (
        <EmptyState
          title="Claim not found"
          description={
            <Link href="/claims" className="text-accent-strong hover:underline">
              Back to claims
            </Link>
          }
          className="mx-auto max-w-md"
        />
      );
    }
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  }
  return <Loaded claim={query.data} />;
}

function Loaded({ claim }: { claim: ClaimDetail }) {
  const canAdmin = usePermission('claims.admin');
  const [move, setMove] = useState<PendingMove | null>(null);
  const [dialog, setDialog] = useState<'edit' | 'assign' | null>(null);
  return (
    <>
      <div className="mb-6 grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight text-primary">{claim.claimNumber}</h1>
          <ClaimStatusBadge status={claim.status} />
          <span className="text-sm text-muted-foreground tabular">
            {daysText(claim.daysInStage)} in {CLAIM_STATUS_LABELS[claim.status]}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {claim.client.name} · policy {claim.policy.policyNumber} ·{' '}
          {claim.assignedTo ? `assigned to ${claim.assignedTo.name}` : 'not assigned'}
        </p>
        <div className="flex flex-wrap gap-2">
          {claim.allowedMoves.map((to) => (
            <Button
              key={to}
              type="button"
              onClick={() =>
                setMove({
                  claimId: claim.id,
                  claimNumber: claim.claimNumber,
                  from: claim.status,
                  to,
                })
              }
            >
              Move to {CLAIM_STATUS_LABELS[to]}
              <ArrowRight aria-hidden="true" />
            </Button>
          ))}
          {claim.canEdit ? (
            <Button type="button" variant="outline" onClick={() => setDialog('edit')}>
              <Pencil aria-hidden="true" />
              Edit details
            </Button>
          ) : null}
          {canAdmin ? (
            <Button type="button" variant="outline" onClick={() => setDialog('assign')}>
              <UserCog aria-hidden="true" />
              Assign
            </Button>
          ) : null}
        </div>
      </div>

      {claim.missingDocuments.length > 0 && claim.status === 'FORM' ? (
        <Alert variant="warning" className="mb-6">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>Needed before Submitted</AlertTitle>
          <AlertDescription>
            {claim.missingDocuments.map((kind) => CLAIM_DOCUMENT_KIND_LABELS[kind]).join(', ')}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <div className="grid min-w-0 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Claim details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm lg:grid-cols-3">
                <Fact label="Company">{claim.client.name}</Fact>
                <Fact label="Policy">
                  {claim.policy.policyNumber} · {claim.policy.insurerName}
                  <span className="block text-xs text-muted-foreground">
                    {formatDate(claim.policy.policyStart)} – {formatDate(claim.policy.policyEnd)} ·{' '}
                    <Link
                      className="text-accent-strong hover:underline"
                      href={`/ghi/${claim.policy.ghiCaseId}`}
                    >
                      {claim.policy.caseReference}
                    </Link>
                  </span>
                </Fact>
                <Fact label="Employee">
                  {claim.employee.name} ({claim.employee.employeeId})
                </Fact>
                <Fact label="Patient">{claim.patient.name}</Fact>
                <Fact label="Relationship">
                  {GHI_RELATIONSHIP_LABELS[claim.patient.relationship]}
                </Fact>
                <Fact label="Hospital">
                  {claim.hospital.city
                    ? `${claim.hospital.name}, ${claim.hospital.city}`
                    : claim.hospital.name}
                </Fact>
                <Fact label="Admission">{formatDate(claim.admissionDate)}</Fact>
                <Fact label="Discharge">{formatDate(claim.dischargeDate)}</Fact>
                <Fact label="Claim type">{CLAIM_TYPE_LABELS[claim.claimType]}</Fact>
                <Fact label="Amount claimed">
                  <span className="font-semibold">{inr(claim.amountClaimed)}</span>
                </Fact>
                <Fact label="Status">{CLAIM_STATUS_LABELS[claim.status]}</Fact>
                <Fact label="Contact">
                  {claim.contactEmail ?? (
                    <span className="text-muted-foreground">No email (added by a TPA import)</span>
                  )}
                  {claim.contactPhone ? <span className="block">{claim.contactPhone}</span> : null}
                </Fact>
                {claim.settlement ? (
                  <Fact label="Settlement (from the TPA)">
                    {claim.settlement.state === 'SETTLED'
                      ? `Settled${claim.settlement.amount ? `, ${inr(claim.settlement.amount)}` : ''}${claim.settlement.date ? ` on ${formatDate(claim.settlement.date)}` : ''}`
                      : 'Not settled'}
                    <span className="block text-xs text-muted-foreground">
                      TPA status “{claim.settlement.tpaStatus}”
                    </span>
                  </Fact>
                ) : null}
                {claim.tpa ? (
                  <Fact label="TPA record">
                    <Link className="text-accent-strong hover:underline" href="/claims/tpa">
                      {claim.tpa.tpaCode} {claim.tpa.tpaClaimId}
                    </Link>
                    <span className="block text-xs text-muted-foreground">
                      Last imported {formatDateTime(claim.tpa.importedAt)}
                    </span>
                  </Fact>
                ) : null}
                <Fact label="Made">
                  {formatDateTime(claim.createdAt)} by {claim.createdBy}
                </Fact>
              </dl>
            </CardContent>
          </Card>
          <ClaimDocuments claim={claim} />
          <ClaimEmails claim={claim} />
        </div>
        <div className="grid min-w-0 content-start gap-6">
          <ClaimRemarks claim={claim} />
          <ClaimTimeline claim={claim} />
        </div>
      </div>
      <MoveDialog move={move} onClose={() => setMove(null)} />
      {dialog === 'edit' ? <EditClaimDialog claim={claim} onClose={() => setDialog(null)} /> : null}
      {dialog === 'assign' ? <AssignDialog claim={claim} onClose={() => setDialog(null)} /> : null}
    </>
  );
}
