'use client';

import { useQuery } from '@tanstack/react-query';
import { CircleAlert, LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { ErrorState, LoadingState, errorMessage } from '@/components/states';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { usePermission } from '@/hooks/use-permission';
import { apiFetch } from '@/lib/api-client';
import { ghiFinalQuery, issuesText, useGhiMutation } from '@/lib/api/ghi';
import {
  GhiFinalQcrStateSchema,
  formatDateTime,
  type GhiCaseRecord,
  type GhiFinalQcrState,
  type GhiQuote,
  type GhiQuoteTermsInput,
} from '@/shared';
import { Field } from './case-actions';
import { Fact, FilePicker, inr } from './ghi-ui';
import { TermsFields } from './terms-fields';

/**
 * The final QCR (G7): the premium and terms finally agreed with the insurer the client chose,
 * recorded as a new version so the quotes and the accepted QCR stay as they were.
 */
export function FinalQcrPanel({ record }: { record: GhiCaseRecord }) {
  const canEdit = usePermission('proposals.edit');
  const query = useQuery(ghiFinalQuery(record.id));
  const [editing, setEditing] = useState(false);
  if (query.isPending) return <LoadingState label="Loading the final QCR" />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const state = query.data;
  if (!state.accepted) {
    return (
      <Alert variant="info">
        <CircleAlert aria-hidden="true" />
        <AlertTitle>Waiting for the client</AlertTitle>
        <AlertDescription>
          Record the client’s acceptance of the approved QCR on the QCR tab first.
        </AlertDescription>
      </Alert>
    );
  }
  const writable = canEdit && record.stage !== 'CLOSED' && !record.placed;
  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Accepted quote</CardTitle>
          <CardDescription>
            From QCR v{state.accepted.qcrVersion}, as the client accepted it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <QuoteFacts quote={state.accepted.quote} />
        </CardContent>
      </Card>
      {state.current && !editing ? (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div className="grid gap-1">
              <CardTitle className="flex items-center gap-2">
                Final agreed terms <Badge variant="success">v{state.current.version}</Badge>
              </CardTitle>
              <CardDescription>
                Recorded by {state.current.createdBy}, {formatDateTime(state.current.createdAt)}
                {state.note ? ` · ${state.note}` : ''}
              </CardDescription>
            </div>
            {writable ? (
              <Button type="button" variant="outline" onClick={() => setEditing(true)}>
                Record revised final terms
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className="grid gap-3">
            <QuoteFacts quote={state.current} />
            {state.current.deviations.length > 0 ? (
              <ul className="grid gap-0.5 text-sm">
                {state.current.deviations.map((deviation) => (
                  <li
                    key={deviation.field}
                    className={deviation.kind === 'DEVIATION' ? 'text-destructive' : 'text-warning'}
                  >
                    {deviation.kind === 'DEVIATION' ? 'Deviation from the RFQ' : 'Not stated'} —{' '}
                    {deviation.label}: {deviation.offered ?? 'not stated'} (asked{' '}
                    {deviation.requested})
                  </li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
      {writable && (!state.current || editing) ? (
        <FinalForm record={record} state={state} onDone={() => setEditing(false)} />
      ) : null}
      {state.history.length > 1 ? (
        <details className="rounded-md border p-3">
          <summary className="cursor-pointer text-sm font-medium">
            Earlier final terms ({state.history.length - 1})
          </summary>
          <ul className="mt-2 grid gap-1 text-sm">
            {state.history.slice(1).map((quote) => (
              <li key={quote.id} className="tabular">
                v{quote.version}: total {inr(quote.totalPremium)} ·{' '}
                {formatDateTime(quote.createdAt)} · {quote.reason ?? ''}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function QuoteFacts({ quote }: { quote: GhiQuote }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
      <Fact label="Insurer">{quote.insurerName}</Fact>
      <Fact label="Base premium">{inr(quote.basePremium)}</Fact>
      <Fact label={`GST (${quote.gstRatePercent}%)`}>{inr(quote.gst)}</Fact>
      <Fact label="Total premium">
        <span className="font-semibold">{inr(quote.totalPremium)}</span>
      </Fact>
      {quote.otherTerms ? <Fact label="Other terms">{quote.otherTerms}</Fact> : null}
    </dl>
  );
}

function FinalForm({
  record,
  state,
  onDone,
}: {
  record: GhiCaseRecord;
  state: GhiFinalQcrState;
  onDone: () => void;
}) {
  const start = state.current ?? state.accepted?.quote ?? null;
  const [basePremium, setBasePremium] = useState(start?.basePremium ?? '');
  const [terms, setTerms] = useState<GhiQuoteTermsInput>(start!.terms);
  const [otherTerms, setOtherTerms] = useState(start?.otherTerms ?? '');
  const [note, setNote] = useState('');
  const [attachmentIds, setAttachmentIds] = useState<string[]>([]);
  const save = useGhiMutation(
    record.id,
    () =>
      apiFetch(`ghi/cases/${record.id}/final-qcr`, {
        method: 'POST',
        body: { basePremium, terms, otherTerms, note, attachmentIds },
        schema: GhiFinalQcrStateSchema,
      }),
    (result) => ({
      title: 'Final QCR recorded',
      description: `Total premium ${inr(result.current?.totalPremium ?? null)}. Record the payment next.`,
    }),
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>{state.current ? 'Revised final terms' : 'Record the final QCR'}</CardTitle>
        <CardDescription>
          Starts from {state.current ? 'the current final terms' : 'the accepted quote'}. GST at{' '}
          {record.gstRatePercent}% and the total are worked out by the system.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Field label="Final base premium before GST (₹)">
          <Input
            inputMode="decimal"
            className="max-w-60"
            value={basePremium ?? ''}
            onChange={(event) => setBasePremium(event.target.value)}
          />
        </Field>
        <TermsFields value={terms} onChange={setTerms} />
        <Field label="Other agreed terms">
          <Textarea
            rows={3}
            maxLength={4000}
            value={otherTerms ?? ''}
            onChange={(event) => setOtherTerms(event.target.value)}
          />
        </Field>
        <Field label="What changed from the accepted quote (optional)">
          <Input maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} />
        </Field>
        <FilePicker
          caseId={record.id}
          purpose="QUOTE"
          label="The insurer’s confirmation (optional)"
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
        <div className="flex flex-wrap justify-end gap-2">
          {state.current ? (
            <Button type="button" variant="outline" onClick={onDone}>
              Cancel
            </Button>
          ) : null}
          <Button
            type="button"
            disabled={save.isPending}
            onClick={() => save.mutate(undefined, { onSuccess: onDone })}
          >
            {save.isPending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
            Record final QCR
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
