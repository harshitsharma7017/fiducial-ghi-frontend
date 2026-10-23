'use client';

import { useQuery } from '@tanstack/react-query';
import { CircleAlert, Copy, LoaderCircle, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ErrorState, LoadingState, errorMessage } from '@/components/states';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { usePermission } from '@/hooks/use-permission';
import { apiFetch } from '@/lib/api-client';
import { ghiFileHref, ghiQuotesQuery, issuesText, useGhiMutation } from '@/lib/api/ghi';
import {
  GhiQuoteSchema,
  emptyGhiQuoteTerms,
  formatDate,
  formatDateTime,
  type GhiCaseInsurer,
  type GhiCaseRecord,
  type GhiQuote,
  type GhiQuoteTermsInput,
  type GhiRequirements,
} from '@/shared';
import { Field } from './case-actions';
import { ConfirmDialog, FilePicker, inr } from './ghi-ui';
import { TermsFields } from './terms-fields';

/** The RFQ's terms as quote terms, for an insurer that quotes exactly as asked. */
export function termsFromRequirements(requirements: GhiRequirements): GhiQuoteTermsInput {
  return {
    coverageType: requirements.coverageType,
    roomRent: requirements.roomRent,
    maternity: requirements.maternity,
    preExistingCovered: requirements.preExistingDiseases.covered,
    parentsCoPayPercent: requirements.parentsCoPayPercent,
    waivers: requirements.waivers,
    waitingPeriods: {
      initialDays: requirements.waivers.initialWaitingPeriod ? 0 : null,
      specificDiseasesMonths: requirements.waivers.twoYearExclusions ? 0 : null,
      preExistingMonths: requirements.waivers.preExistingWaitingPeriod ? 0 : null,
      maternityMonths: requirements.maternity.nineMonthWaiver ? 0 : null,
    },
    corporateBufferAmount: requirements.corporateBuffer.amount,
  };
}

/** Insurers' quotes (G6): drafts, recorded versions and revisions, with deviations from the RFQ. */
export function QuotesPanel({ record }: { record: GhiCaseRecord }) {
  const canEdit = usePermission('gmc.edit');
  const quotes = useQuery(ghiQuotesQuery(record.id));
  const [editing, setEditing] = useState<{
    insurer: GhiCaseInsurer;
    draft: GhiQuote | null;
    from: GhiQuote | null;
  } | null>(null);
  const [deleting, setDeleting] = useState<GhiQuote | null>(null);
  const remove = useGhiMutation(
    record.id,
    (quote: GhiQuote) =>
      apiFetch(`ghi/cases/${record.id}/quotes/${quote.id}`, { method: 'DELETE' }),
    () => ({ title: 'Draft deleted' }),
  );
  if (quotes.isPending) return <LoadingState label="Loading quotes" />;
  if (quotes.isError)
    return <ErrorState error={quotes.error} onRetry={() => void quotes.refetch()} />;
  const writable = canEdit && record.stage !== 'CLOSED' && record.finalQcr === null;
  const sent = record.insurers.filter((insurer) => insurer.status !== 'NOT_SENT');

  return (
    <div className="grid gap-6">
      {sent.length === 0 ? (
        <Alert variant="info">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>No insurer has the RFQ yet</AlertTitle>
          <AlertDescription>Quotes are recorded for insurers the RFQ was sent to.</AlertDescription>
        </Alert>
      ) : null}
      {record.insurers.map((insurer) => {
        const mine = quotes.data.items.filter(
          (quote) => quote.insurerId === insurer.insurerId && quote.kind === 'QUOTE',
        );
        const draft = mine.find((quote) => quote.status === 'DRAFT') ?? null;
        const latest = mine.find((quote) => quote.latest) ?? null;
        return (
          <Card key={insurer.insurerId}>
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
              <div className="grid gap-1">
                <CardTitle>
                  {insurer.company}, {insurer.branch}
                </CardTitle>
                <CardDescription>
                  {latest
                    ? `Latest: v${latest.version}, total ${inr(latest.totalPremium)}`
                    : insurer.status === 'DECLINED'
                      ? `Declined: ${insurer.declineReason ?? ''}`
                      : 'No quote recorded yet.'}
                </CardDescription>
              </div>
              {writable && insurer.status !== 'NOT_SENT' ? (
                draft ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditing({ insurer, draft, from: null })}
                  >
                    <Pencil aria-hidden="true" />
                    Continue the draft
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={() => setEditing({ insurer, draft: null, from: latest })}
                  >
                    <Plus aria-hidden="true" />
                    {latest ? 'Record a revised quote' : 'Record the quote'}
                  </Button>
                )
              ) : null}
            </CardHeader>
            {mine.length > 0 ? (
              <CardContent className="grid gap-3">
                {mine.map((quote) => (
                  <QuoteRow
                    key={quote.id}
                    caseId={record.id}
                    quote={quote}
                    onDelete={
                      writable && quote.status === 'DRAFT' ? () => setDeleting(quote) : undefined
                    }
                  />
                ))}
              </CardContent>
            ) : null}
          </Card>
        );
      })}
      {editing ? (
        <QuoteDialog
          record={record}
          insurer={editing.insurer}
          draft={editing.draft}
          from={editing.from}
          onClose={() => setEditing(null)}
        />
      ) : null}
      <ConfirmDialog
        open={deleting !== null}
        title="Delete this draft?"
        description="The draft quote is removed. Recorded quotes are never deleted."
        confirmLabel="Delete draft"
        pending={remove.isPending}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        onConfirm={() => {
          if (deleting) remove.mutate(deleting, { onSettled: () => setDeleting(null) });
        }}
      />
    </div>
  );
}

function QuoteRow({
  caseId,
  quote,
  onDelete,
}: {
  caseId: string;
  quote: GhiQuote;
  onDelete?: () => void;
}) {
  return (
    <div className="grid gap-2 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">v{quote.version}</span>
        {quote.status === 'DRAFT' ? (
          <Badge variant="muted">Draft</Badge>
        ) : quote.latest ? (
          <Badge variant="success">Latest</Badge>
        ) : (
          <Badge variant="outline">Superseded</Badge>
        )}
        <span className="tabular">
          Base {inr(quote.basePremium)} · GST {quote.gstRatePercent}% {inr(quote.gst)} ·{' '}
          <span className="font-semibold">Total {inr(quote.totalPremium)}</span>
        </span>
        <span className="text-xs text-muted-foreground">
          {quote.finalizedAt
            ? `Recorded by ${quote.finalizedBy ?? ''}, ${formatDateTime(quote.finalizedAt)}`
            : `Saved by ${quote.createdBy}`}
          {quote.validUntil ? ` · valid until ${formatDate(quote.validUntil)}` : ''}
        </span>
        {onDelete ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="ml-auto"
            aria-label={`Delete draft v${quote.version}`}
            onClick={onDelete}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        ) : null}
      </div>
      {quote.reason ? <p className="text-sm">Revised: {quote.reason}</p> : null}
      {quote.deviations.length > 0 ? (
        <ul className="grid gap-0.5 text-sm" aria-label={`Deviations of v${quote.version}`}>
          {quote.deviations.map((deviation) => (
            <li
              key={deviation.field}
              className={deviation.kind === 'DEVIATION' ? 'text-destructive' : 'text-warning'}
            >
              {deviation.kind === 'DEVIATION' ? 'Deviation' : 'Missing'} — {deviation.label}: asked{' '}
              {deviation.requested}, offered {deviation.offered ?? 'not stated'}
            </li>
          ))}
        </ul>
      ) : quote.status === 'FINAL' ? (
        <p className="text-sm text-success">Matches the RFQ.</p>
      ) : null}
      {quote.otherTerms ? (
        <p className="text-sm text-muted-foreground">{quote.otherTerms}</p>
      ) : null}
      {quote.attachments.length > 0 ? (
        <p className="text-sm">
          {quote.attachments.map((file) => (
            <a
              key={file.id}
              className="mr-3 text-accent-strong hover:underline"
              href={ghiFileHref(caseId, file.id)}
            >
              {file.fileName}
            </a>
          ))}
        </p>
      ) : null}
    </div>
  );
}

function QuoteDialog({
  record,
  insurer,
  draft,
  from,
  onClose,
}: {
  record: GhiCaseRecord;
  insurer: GhiCaseInsurer;
  draft: GhiQuote | null;
  from: GhiQuote | null;
  onClose: () => void;
}) {
  const start = draft ?? from;
  const [basePremium, setBasePremium] = useState(start?.basePremium ?? '');
  const [terms, setTerms] = useState<GhiQuoteTermsInput>(start?.terms ?? emptyGhiQuoteTerms());
  const [otherTerms, setOtherTerms] = useState(start?.otherTerms ?? '');
  const [validUntil, setValidUntil] = useState(start?.validUntil ?? '');
  const [reason, setReason] = useState(draft?.reason ?? '');
  const [attachmentIds, setAttachmentIds] = useState<string[]>(
    draft?.attachments.map((file) => file.id) ?? [],
  );
  const revision = from !== null || (draft !== null && draft.version > 1);
  const save = useGhiMutation(
    record.id,
    (finalize: boolean) => {
      const body = { basePremium, terms, otherTerms, validUntil, reason, attachmentIds, finalize };
      return draft
        ? apiFetch(`ghi/cases/${record.id}/quotes/${draft.id}`, {
            method: 'PUT',
            body,
            schema: GhiQuoteSchema,
          })
        : apiFetch(`ghi/cases/${record.id}/quotes`, {
            method: 'POST',
            body: { ...body, insurerId: insurer.insurerId },
            schema: GhiQuoteSchema,
          });
    },
    (quote) =>
      quote.status === 'FINAL'
        ? {
            title: `Quote v${quote.version} recorded`,
            description: `Total ${inr(quote.totalPremium)} (GST ${inr(quote.gst)})`,
          }
        : { title: 'Draft saved' },
  );
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {draft ? `Draft quote v${draft.version}` : revision ? 'Revised quote' : 'Quote'}:{' '}
            {insurer.company}
          </DialogTitle>
          <DialogDescription>
            GST at {record.gstRatePercent}% and the total are worked out by the system when saved. A
            recorded quote does not change; a later change is a revised version.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Base premium before GST (₹)">
              <Input
                inputMode="decimal"
                value={basePremium ?? ''}
                onChange={(event) => setBasePremium(event.target.value)}
              />
            </Field>
            <Field label="Valid until (optional)">
              <Input
                type="date"
                value={validUntil ?? ''}
                onChange={(event) => setValidUntil(event.target.value)}
              />
            </Field>
            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setTerms(termsFromRequirements(record.requirements))}
              >
                <Copy aria-hidden="true" />
                Start from the RFQ’s terms
              </Button>
            </div>
          </div>
          <TermsFields value={terms} onChange={setTerms} />
          <Field label="Other terms offered">
            <Textarea
              rows={3}
              maxLength={4000}
              value={otherTerms ?? ''}
              onChange={(event) => setOtherTerms(event.target.value)}
            />
          </Field>
          {revision ? (
            <Field label="Why the insurer revised its quote">
              <Input
                maxLength={500}
                value={reason ?? ''}
                onChange={(event) => setReason(event.target.value)}
              />
            </Field>
          ) : null}
          <FilePicker
            caseId={record.id}
            purpose="QUOTE"
            label="The insurer’s quote (mail or PDF)"
            value={attachmentIds}
            onChange={setAttachmentIds}
          />
          {save.isError ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>
                {issuesText(save.error) ?? errorMessage(save.error)}
              </AlertDescription>
            </Alert>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={save.isPending}
            onClick={() => save.mutate(false, { onSuccess: onClose })}
          >
            Save as draft
          </Button>
          <Button
            type="button"
            disabled={save.isPending}
            onClick={() => save.mutate(true, { onSuccess: onClose })}
          >
            {save.isPending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
            Record quote
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
