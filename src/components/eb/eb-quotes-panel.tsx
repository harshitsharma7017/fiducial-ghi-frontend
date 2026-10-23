'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LoaderCircle, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { FilePicker, inr, rupees } from '@/components/ghi/ghi-ui';
import { EmptyState, ErrorState, LoadingState, errorMessage } from '@/components/states';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { NativeSelect } from '@/components/ui/native-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { usePermission } from '@/hooks/use-permission';
import { ApiError, apiFetch } from '@/lib/api-client';
import { caseApi, refreshGhiCase } from '@/lib/api/ghi';
import { ebQuotesQuery } from '@/lib/eb/api';
import {
  casePermission,
  COVER_OFFER_LABELS,
  COVER_OFFERS,
  EbQuoteSchema,
  emptyGpaQuoteTerms,
  emptyGtliQuoteTerms,
  formatDateTime,
  GPA_COVER_LABELS,
  GPA_COVERS,
  type CoverOffer,
  type EbCaseRecord,
  type EbQuote,
  type GpaQuoteTerms,
  type GtliQuoteTerms,
} from '@/shared';
import { z } from 'zod';
import { AwaitingNote } from './awaiting-confirmation';
import { Field } from './eb-ui';

/**
 * Insurers' GPA and GTLI quotes (Requirement 7): every version kept, drafts editable, a
 * revision with its reason. GST and totals are the API's (7.2); the rate stated is kept as text.
 */
export function EbQuotesPanel({ record }: { record: EbCaseRecord }) {
  const canEdit = usePermission(casePermission(record.product, 'edit'));
  const quotes = useQuery(ebQuotesQuery(record.product, record.id));
  const [editing, setEditing] = useState<EbQuote | 'new' | null>(null);
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: (quote: EbQuote) =>
      apiFetch(`${caseApi(record.product, record.id)}/quotes/${quote.id}`, {
        method: 'DELETE',
        schema: z.unknown(),
      }),
    onSuccess: () => refreshGhiCase(queryClient, record.id),
  });
  const writable = canEdit && record.stage !== 'CLOSED' && !record.placed;
  const sent = record.insurers.filter((insurer) => insurer.status !== 'NOT_SENT');
  if (quotes.isPending) return <LoadingState label="Loading quotes" />;
  if (quotes.isError)
    return <ErrorState error={quotes.error} onRetry={() => void quotes.refetch()} />;
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <CardTitle>Quotes</CardTitle>
          <CardDescription>
            The QCR compares each insurer’s latest recorded version; drafts never count.
          </CardDescription>
        </div>
        {writable && sent.length > 0 ? (
          <Button type="button" onClick={() => setEditing('new')}>
            <Plus aria-hidden="true" />
            Record a quote
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="grid gap-3">
        {quotes.data.items.length === 0 ? (
          <EmptyState
            title="No quote yet"
            description={
              sent.length === 0
                ? 'Send the RFQ first.'
                : 'Record the insurers’ quotes as they arrive.'
            }
          />
        ) : (
          <div
            role="region"
            aria-label="Quotes"
            tabIndex={0}
            className="overflow-x-auto rounded-md border"
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Insurer</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead className="text-right">Base premium</TableHead>
                  <TableHead className="text-right">GST</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Rate as stated</TableHead>
                  <TableHead>Gaps</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotes.data.items.map((quote) => (
                  <TableRow key={quote.id}>
                    <TableCell>{quote.insurerName}</TableCell>
                    <TableCell>
                      v{quote.version}{' '}
                      <Badge
                        variant={
                          quote.status === 'DRAFT' ? 'muted' : quote.latest ? 'success' : 'default'
                        }
                      >
                        {quote.status === 'DRAFT' ? 'Draft' : quote.latest ? 'Latest' : 'Earlier'}
                      </Badge>
                      {quote.reason ? (
                        <span className="block text-xs text-muted-foreground">{quote.reason}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right tabular">{inr(quote.basePremium)}</TableCell>
                    <TableCell className="text-right tabular">
                      {inr(quote.gst)}{' '}
                      <span className="text-xs text-muted-foreground">
                        ({quote.gstRatePercent}%)
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular">
                      {inr(quote.totalPremium)}
                    </TableCell>
                    <TableCell>{quote.statedRate ?? '—'}</TableCell>
                    <TableCell className="text-xs">
                      {quote.deviations.length === 0
                        ? 'None'
                        : quote.deviations
                            .map(
                              (item) =>
                                `${item.label}: ${item.kind === 'DEVIATION' ? 'deviation' : 'missing'}`,
                            )
                            .join('; ')}
                    </TableCell>
                    <TableCell>
                      {writable && quote.status === 'DRAFT' ? (
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Edit the draft of ${quote.insurerName}`}
                            onClick={() => setEditing(quote)}
                          >
                            <Pencil aria-hidden="true" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Delete the draft of ${quote.insurerName}`}
                            onClick={() => remove.mutate(quote)}
                          >
                            <Trash2 aria-hidden="true" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {quote.finalizedAt ? formatDateTime(quote.finalizedAt) : ''}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {remove.isError ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{errorMessage(remove.error)}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
      {editing ? (
        <QuoteDialog
          record={record}
          quote={editing === 'new' ? null : editing}
          quotes={quotes.data.items}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </Card>
  );
}

function QuoteDialog({
  record,
  quote,
  quotes,
  onClose,
}: {
  record: EbCaseRecord;
  quote: EbQuote | null;
  quotes: EbQuote[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const gpa = record.product === 'GPA';
  const sent = record.insurers.filter((insurer) => insurer.status !== 'NOT_SENT');
  const [insurerId, setInsurerId] = useState(quote?.insurerId ?? '');
  const [basePremium, setBasePremium] = useState(quote?.basePremium ?? '');
  const [statedRate, setStatedRate] = useState(quote?.statedRate ?? '');
  const [terms, setTerms] = useState<GpaQuoteTerms | GtliQuoteTerms>(
    quote?.terms ?? (gpa ? emptyGpaQuoteTerms() : emptyGtliQuoteTerms()),
  );
  const [otherTerms, setOtherTerms] = useState(quote?.otherTerms ?? '');
  const [reason, setReason] = useState(quote?.reason ?? '');
  const [attachmentIds, setAttachmentIds] = useState<string[]>(
    quote?.attachments.map((file) => file.id) ?? [],
  );
  const revision = quotes.some(
    (item) => item.insurerId === insurerId && item.status === 'FINAL' && item.id !== quote?.id,
  );
  const save = useMutation({
    mutationFn: (finalize: boolean) => {
      const body = {
        basePremium,
        statedRate,
        terms,
        otherTerms,
        validUntil: '',
        reason,
        attachmentIds,
        finalize,
        ...(quote ? {} : { insurerId }),
      };
      const base = caseApi(record.product, record.id);
      return apiFetch(quote ? `${base}/quotes/${quote.id}` : `${base}/quotes`, {
        method: quote ? 'PUT' : 'POST',
        body,
        schema: EbQuoteSchema,
      });
    },
    onSuccess: () => {
      refreshGhiCase(queryClient, record.id);
      onClose();
    },
  });
  const fieldError = (path: string) => {
    const error = save.error;
    if (!(error instanceof ApiError) || !Array.isArray(error.details)) return null;
    const item = (error.details as Array<{ path: string; message: string }>).find(
      (detail) => detail.path === path,
    );
    return item ? <span className="text-xs text-destructive">{item.message}</span> : null;
  };
  const gpaTerms = terms as GpaQuoteTerms;
  const gtliTerms = terms as GtliQuoteTerms;
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{quote ? `Draft quote v${quote.version}` : 'Record a quote'}</DialogTitle>
          <DialogDescription>
            GST and the total are worked out by the server at the case’s GST rate.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Insurer">
            <NativeSelect
              value={insurerId}
              disabled={Boolean(quote)}
              onChange={(event) => setInsurerId(event.target.value)}
            >
              <option value="">Choose the insurer</option>
              {sent.map((insurer) => (
                <option key={insurer.insurerId} value={insurer.insurerId}>
                  {insurer.company}, {insurer.branch}
                </option>
              ))}
            </NativeSelect>
            {fieldError('insurerId')}
          </Field>
          <Field label="Base premium before GST (₹)">
            <Input
              inputMode="decimal"
              value={basePremium}
              onChange={(event) => setBasePremium(event.target.value.replace(/[₹,\s]/g, ''))}
            />
            {fieldError('basePremium')}
          </Field>
          <Field
            label="Rate as the insurer states it (optional)"
            hint="Kept as text; used in no calculation."
          >
            <Input value={statedRate} onChange={(event) => setStatedRate(event.target.value)} />
          </Field>
          {revision ? (
            <Field label="Why the insurer revised its quote">
              <Input value={reason} onChange={(event) => setReason(event.target.value)} />
              {fieldError('reason')}
            </Field>
          ) : null}
        </div>
        {gpa ? (
          <div className="grid gap-3">
            <AwaitingNote>Cover limits are shown as given (open question 10).</AwaitingNote>
            {GPA_COVERS.map((cover) => (
              <div key={cover} className="grid gap-2 rounded-md border p-3 sm:grid-cols-3">
                <Field label={GPA_COVER_LABELS[cover]}>
                  <NativeSelect
                    value={gpaTerms.covers[cover].offer}
                    onChange={(event) =>
                      setTerms({
                        covers: {
                          ...gpaTerms.covers,
                          [cover]: {
                            ...gpaTerms.covers[cover],
                            offer: event.target.value as CoverOffer,
                          },
                        },
                      })
                    }
                  >
                    {COVER_OFFERS.map((offer) => (
                      <option key={offer} value={offer}>
                        {COVER_OFFER_LABELS[offer]}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="Limit (₹, optional)">
                  <Input
                    inputMode="numeric"
                    value={gpaTerms.covers[cover].limitAmount ?? ''}
                    onChange={(event) => {
                      const amount = event.target.value.replace(/[₹,\s]/g, '');
                      setTerms({
                        covers: {
                          ...gpaTerms.covers,
                          [cover]: {
                            ...gpaTerms.covers[cover],
                            limitAmount: amount === '' ? null : amount,
                          },
                        },
                      });
                    }}
                  />
                </Field>
                <Field label="Limit as text (optional)">
                  <Input
                    value={gpaTerms.covers[cover].limitText ?? ''}
                    onChange={(event) =>
                      setTerms({
                        covers: {
                          ...gpaTerms.covers,
                          [cover]: { ...gpaTerms.covers[cover], limitText: event.target.value },
                        },
                      })
                    }
                  />
                </Field>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Free cover limit offered (₹, blank: not stated)">
              <Input
                inputMode="numeric"
                value={gtliTerms.freeCoverLimit ?? ''}
                onChange={(event) => {
                  const amount = event.target.value.replace(/[₹,\s]/g, '');
                  setTerms({ ...gtliTerms, freeCoverLimit: amount === '' ? null : amount });
                }}
              />
              {fieldError('terms.freeCoverLimit')}
            </Field>
            <Field label="Additional benefits offered">
              <Input
                value={gtliTerms.additionalBenefits ?? ''}
                onChange={(event) =>
                  setTerms({ ...gtliTerms, additionalBenefits: event.target.value })
                }
              />
            </Field>
            <p className="text-xs text-muted-foreground sm:col-span-2">
              Asked for: free cover limit{' '}
              {rupees(record.product === 'GTLI' ? record.requirements.freeCoverLimit : null)}.
            </p>
          </div>
        )}
        <Field label="Other terms">
          <Textarea
            rows={2}
            value={otherTerms}
            onChange={(event) => setOtherTerms(event.target.value)}
          />
        </Field>
        <FilePicker
          caseId={record.id}
          product={record.product}
          purpose="QUOTE"
          label="The insurer’s mail or PDF (at least one to record)"
          value={attachmentIds}
          onChange={setAttachmentIds}
        />
        {fieldError('attachmentIds')}
        {save.isError &&
        !(save.error instanceof ApiError && save.error.code === 'VALIDATION_ERROR') ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{errorMessage(save.error)}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={save.isPending || !insurerId}
            onClick={() => save.mutate(false)}
          >
            Save as draft
          </Button>
          <Button
            type="button"
            disabled={save.isPending || !insurerId}
            onClick={() => save.mutate(true)}
          >
            {save.isPending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
            Record quote
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
