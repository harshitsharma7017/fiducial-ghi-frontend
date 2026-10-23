'use client';

import { useQuery } from '@tanstack/react-query';
import { CircleAlert, FileCheck2, LoaderCircle, Mail, Pencil, Send } from 'lucide-react';
import { useState } from 'react';
import { ErrorState, LoadingState, errorMessage } from '@/components/states';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { usePermission } from '@/hooks/use-permission';
import { apiFetch } from '@/lib/api-client';
import { ghiQcrsQuery, ghiQuotesQuery, issuesText, useGhiMutation } from '@/lib/api/ghi';
import {
  GHI_QCR_STATUS_LABELS,
  GhiQcrSchema,
  MAX_GHI_INSURERS,
  formatDate,
  formatDateTime,
  type GhiCaseRecord,
  type GhiQcr,
} from '@/shared';
import { Field } from './case-actions';
import { ClientDecisionDialog, SendQcrDialog } from './qcr-dialogs';
import { QcrTable } from './qcr-table';
import { DownloadButton, inr } from './ghi-ui';
import { DispatchLog } from './rfq-insurers';

const STATUS_VARIANT = {
  DRAFT: 'muted',
  SUBMITTED: 'warning',
  APPROVED: 'success',
  REJECTED: 'destructive',
} as const;

/** The QCR (G6): prepared from the latest final quotes, approved, sent and decided by the client. */
export function QcrPanel({ record }: { record: GhiCaseRecord }) {
  const canEdit = usePermission('gmc.edit');
  const qcrs = useQuery(ghiQcrsQuery(record.id));
  const [editing, setEditing] = useState(false);
  if (qcrs.isPending) return <LoadingState label="Loading the QCR" />;
  if (qcrs.isError) return <ErrorState error={qcrs.error} onRetry={() => void qcrs.refetch()} />;
  const [latest, ...older] = qcrs.data.items;
  const open = record.stage !== 'CLOSED' && record.finalQcr === null;
  const canPrepare =
    canEdit &&
    open &&
    (!latest ||
      latest.status === 'REJECTED' ||
      (latest.status === 'APPROVED' && latest.clientDecision?.decision === 'REJECTED'));
  const editable =
    canEdit &&
    open &&
    latest !== undefined &&
    (latest.status === 'DRAFT' || latest.status === 'REJECTED');

  return (
    <div className="grid gap-6">
      {(canPrepare && !latest) || editing ? (
        <QcrForm
          record={record}
          qcr={editing ? (latest ?? null) : null}
          onDone={() => setEditing(false)}
        />
      ) : null}
      {canPrepare && latest && !editing ? (
        <div>
          <Button type="button" onClick={() => setEditing(true)}>
            Prepare a new QCR version
          </Button>
        </div>
      ) : null}
      {latest ? (
        <QcrCard
          record={record}
          qcr={latest}
          mailEnabled={qcrs.data.mailEnabled}
          onEdit={editable ? () => setEditing(true) : undefined}
        />
      ) : null}
      {!latest && !canPrepare ? (
        <p className="text-sm text-muted-foreground">No QCR prepared yet.</p>
      ) : null}
      {older.length > 0 ? (
        <details className="rounded-md border p-3">
          <summary className="cursor-pointer text-sm font-medium">
            Earlier versions ({older.length})
          </summary>
          <div className="mt-3 grid gap-4">
            {older.map((qcr) => (
              <div key={qcr.id} className="grid gap-2">
                <p className="text-sm">
                  v{qcr.version} · {GHI_QCR_STATUS_LABELS[qcr.status]}
                  {qcr.decision?.comment ? ` · ${qcr.decision.comment}` : ''}
                  {qcr.clientDecision
                    ? ` · client ${qcr.clientDecision.decision === 'ACCEPTED' ? 'accepted' : 'rejected'}`
                    : ''}
                </p>
                <QcrTable qcr={qcr} />
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function QcrForm({
  record,
  qcr,
  onDone,
}: {
  record: GhiCaseRecord;
  qcr: GhiQcr | null;
  onDone: () => void;
}) {
  const quotes = useQuery(ghiQuotesQuery(record.id));
  const latest = (quotes.data?.items ?? []).filter((quote) => quote.latest);
  const reuse = qcr && (qcr.status === 'DRAFT' || qcr.status === 'REJECTED');
  const [quoteIds, setQuoteIds] = useState<string[]>(() =>
    reuse ? qcr.columns.map((column) => column.quoteId) : [],
  );
  const [recommended, setRecommended] = useState<string | null>(
    reuse ? qcr.recommendedInsurerId : null,
  );
  const [remarks, setRemarks] = useState(reuse ? (qcr.remarks ?? '') : '');
  const chosen =
    quoteIds.length > 0 ? quoteIds : latest.slice(0, MAX_GHI_INSURERS).map((quote) => quote.id);
  const save = useGhiMutation(
    record.id,
    () => {
      const body = { quoteIds: chosen, recommendedInsurerId: recommended, remarks };
      return reuse
        ? apiFetch(`ghi/cases/${record.id}/qcrs/${qcr.id}`, {
            method: 'PUT',
            body,
            schema: GhiQcrSchema,
          })
        : apiFetch(`ghi/cases/${record.id}/qcrs`, { method: 'POST', body, schema: GhiQcrSchema });
    },
    (saved) => ({
      title: `QCR v${saved.version} saved`,
      description: 'Submit it for approval next.',
    }),
  );
  if (quotes.isPending) return <LoadingState label="Loading quotes" />;
  if (quotes.isError)
    return <ErrorState error={quotes.error} onRetry={() => void quotes.refetch()} />;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{reuse ? `Edit QCR v${qcr.version}` : 'Prepare the QCR'}</CardTitle>
        <CardDescription>
          Compare up to {MAX_GHI_INSURERS} insurers’ latest recorded quotes.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {latest.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Record at least one insurer’s quote on the Quotes tab first.
          </p>
        ) : (
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">Quotes compared</legend>
            {latest.map((quote) => {
              const id = `qcr-quote-${quote.id}`;
              const checked = chosen.includes(quote.id);
              return (
                <div key={quote.id} className="flex flex-wrap items-center gap-3 text-sm">
                  <Checkbox
                    id={id}
                    checked={checked}
                    disabled={!checked && chosen.length >= MAX_GHI_INSURERS}
                    onCheckedChange={(value) =>
                      setQuoteIds(
                        value ? [...chosen, quote.id] : chosen.filter((item) => item !== quote.id),
                      )
                    }
                  />
                  <Label htmlFor={id} className="font-normal">
                    {quote.insurerName} · v{quote.version} · total {inr(quote.totalPremium)} ·{' '}
                    {quote.deviations.length} deviation(s)
                  </Label>
                  <label className="ml-auto flex items-center gap-1.5 text-xs">
                    <input
                      type="radio"
                      name="qcr-recommended"
                      checked={recommended === quote.insurerId}
                      disabled={!checked}
                      onChange={() => setRecommended(quote.insurerId)}
                      className="size-4 accent-[var(--primary)]"
                    />
                    Recommend
                  </label>
                </div>
              );
            })}
          </fieldset>
        )}
        <Field label="Remarks and recommendation">
          <Textarea
            rows={3}
            maxLength={2000}
            value={remarks}
            onChange={(event) => setRemarks(event.target.value)}
          />
        </Field>
        {save.isError ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>
              {issuesText(save.error) ?? errorMessage(save.error)}
            </AlertDescription>
          </Alert>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2">
          {qcr ? (
            <Button type="button" variant="outline" onClick={onDone}>
              Cancel
            </Button>
          ) : null}
          <Button
            type="button"
            disabled={save.isPending || chosen.length === 0}
            onClick={() => save.mutate(undefined, { onSuccess: onDone })}
          >
            {save.isPending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
            Save QCR
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function QcrCard({
  record,
  qcr,
  mailEnabled,
  onEdit,
}: {
  record: GhiCaseRecord;
  qcr: GhiQcr;
  mailEnabled: boolean;
  onEdit?: () => void;
}) {
  const canEdit = usePermission('gmc.edit');
  const canApprove = usePermission('gmc.approve');
  const canSend = usePermission('gmc.send');
  const canExport = usePermission('gmc.export');
  const [comment, setComment] = useState('');
  const [dialog, setDialog] = useState<'send' | 'decision' | null>(null);
  const open = record.stage !== 'CLOSED' && record.finalQcr === null;
  const submit = useGhiMutation(
    record.id,
    () =>
      apiFetch(`ghi/cases/${record.id}/qcrs/${qcr.id}/submit`, {
        method: 'POST',
        schema: GhiQcrSchema,
      }),
    () => ({ title: 'QCR submitted for approval' }),
  );
  const decide = useGhiMutation(
    record.id,
    (decision: 'APPROVED' | 'REJECTED') =>
      apiFetch(`ghi/cases/${record.id}/qcrs/${qcr.id}/decision`, {
        method: 'POST',
        body: { decision, comment },
        schema: GhiQcrSchema,
      }),
    (_result, decision) => ({
      title: decision === 'APPROVED' ? 'QCR approved' : 'QCR rejected',
      description: decision === 'REJECTED' ? 'The case is back at QCR.' : undefined,
    }),
  );
  const error = submit.error ?? decide.error;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <CardTitle className="flex flex-wrap items-center gap-2">
            QCR v{qcr.version}
            <Badge variant={STATUS_VARIANT[qcr.status]}>{GHI_QCR_STATUS_LABELS[qcr.status]}</Badge>
          </CardTitle>
          <CardDescription>
            Prepared by {qcr.createdBy}, {formatDateTime(qcr.createdAt)}
            {qcr.submitted ? ` · submitted by ${qcr.submitted.by}` : ''}
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          {onEdit ? (
            <Button type="button" variant="outline" onClick={onEdit}>
              <Pencil aria-hidden="true" />
              Edit
            </Button>
          ) : null}
          {canExport ? (
            <>
              <DownloadButton
                path={`ghi/cases/${record.id}/qcrs/${qcr.id}/document?format=xlsx`}
                fallbackName="GHI-QCR.xlsx"
              >
                Excel
              </DownloadButton>
              <DownloadButton
                path={`ghi/cases/${record.id}/qcrs/${qcr.id}/document?format=pdf`}
                fallbackName="GHI-QCR.pdf"
              >
                PDF
              </DownloadButton>
            </>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <QcrTable qcr={qcr} />
        {qcr.remarks ? (
          <p className="text-sm">
            <span className="text-muted-foreground">Remarks: </span>
            {qcr.remarks}
          </p>
        ) : null}
        {qcr.decision ? (
          <p className="text-sm">
            {qcr.decision.status === 'APPROVED' ? 'Approved' : 'Rejected'} by{' '}
            <span className="font-medium">{qcr.decision.by}</span>,{' '}
            {formatDateTime(qcr.decision.at)}
            {qcr.decision.comment ? `: ${qcr.decision.comment}` : ''}
          </p>
        ) : null}
        {qcr.clientDecision ? (
          <Alert variant={qcr.clientDecision.decision === 'ACCEPTED' ? 'success' : 'warning'}>
            <FileCheck2 aria-hidden="true" />
            <AlertTitle>
              Client{' '}
              {qcr.clientDecision.decision === 'ACCEPTED'
                ? `accepted ${qcr.clientDecision.insurerName ?? ''}`
                : 'rejected the QCR'}
            </AlertTitle>
            <AlertDescription>
              On {formatDate(qcr.clientDecision.decidedOn)}, confirmed by{' '}
              {qcr.clientDecision.confirmedBy}; recorded by {qcr.clientDecision.recordedBy}.
              {qcr.clientDecision.note ? ` ${qcr.clientDecision.note}` : ''}
            </AlertDescription>
          </Alert>
        ) : null}
        {open ? (
          <div className="flex flex-wrap gap-2">
            {canEdit && qcr.status === 'DRAFT' ? (
              <Button
                type="button"
                disabled={submit.isPending}
                onClick={() => submit.mutate(undefined)}
              >
                <Send aria-hidden="true" />
                Submit for approval
              </Button>
            ) : null}
            {qcr.status === 'APPROVED' && canSend ? (
              <Button
                type="button"
                variant="outline"
                disabled={!mailEnabled}
                onClick={() => setDialog('send')}
              >
                <Mail aria-hidden="true" />
                Email to the client
              </Button>
            ) : null}
            {qcr.status === 'APPROVED' && canEdit ? (
              <Button type="button" onClick={() => setDialog('decision')}>
                Record the client’s decision
              </Button>
            ) : null}
          </div>
        ) : null}
        {qcr.status === 'APPROVED' && !mailEnabled ? (
          <p className="text-sm text-muted-foreground">
            Mail is turned off on this server: download the QCR and send it yourself.
          </p>
        ) : null}
        {open && canApprove && qcr.status === 'SUBMITTED' ? (
          <div className="grid gap-2 rounded-md border p-3">
            <p className="text-sm font-medium">Approve QCR v{qcr.version}</p>
            <Textarea
              rows={2}
              aria-label="Comment (required to reject)"
              placeholder="Comment (required to reject)"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={decide.isPending}
                onClick={() => decide.mutate('APPROVED')}
              >
                Approve
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={decide.isPending || !comment.trim()}
                onClick={() => decide.mutate('REJECTED')}
              >
                Reject with comment
              </Button>
            </div>
          </div>
        ) : null}
        {error ? (
          <Alert variant="destructive" role="alert">
            <CircleAlert aria-hidden="true" />
            <AlertDescription>{issuesText(error) ?? errorMessage(error)}</AlertDescription>
          </Alert>
        ) : null}
        <DispatchLog dispatches={qcr.sends} title="QCR mails to the client" />
      </CardContent>
      {dialog === 'send' ? (
        <SendQcrDialog record={record} qcr={qcr} onClose={() => setDialog(null)} />
      ) : null}
      {dialog === 'decision' ? (
        <ClientDecisionDialog record={record} qcr={qcr} onClose={() => setDialog(null)} />
      ) : null}
    </Card>
  );
}
