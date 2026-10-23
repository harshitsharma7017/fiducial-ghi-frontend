'use client';

import { useQuery } from '@tanstack/react-query';
import { CircleAlert, LoaderCircle, Mail, Send, Users } from 'lucide-react';
import { useState } from 'react';
import { z } from 'zod';
import { ErrorState, LoadingState, errorMessage } from '@/components/states';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { apiFetch } from '@/lib/api-client';
import {
  AnyRecordSchema,
  caseApi,
  issuesText,
  useGhiMutation,
  type WorkflowCase,
} from '@/lib/api/ghi';
import {
  GhiSendOutcomeSchema,
  GHI_INSURER_STATUS_LABELS,
  InsurerListResponseSchema,
  MAX_GHI_INSURERS,
  formatDate,
  formatDateTime,
  type DispatchGhiRfqResponse,
  type GhiCaseInsurer,
  type GhiDispatch,
  type GhiRfqState,
} from '@/shared';
import { Field } from './case-actions';

const STATUS_VARIANT = {
  NOT_SENT: 'muted',
  SENT: 'info',
  QUOTED: 'success',
  DECLINED: 'destructive',
} as const;

/** The insurers on the case (up to five), where each stands, and sending the approved RFQ. */
export function RfqInsurers({ record, state }: { record: WorkflowCase; state: GhiRfqState }) {
  const canEdit = usePermission('gmc.edit');
  const canSend = usePermission('gmc.send');
  const [dialog, setDialog] = useState<'choose' | 'send' | 'outside' | null>(null);
  const [declining, setDeclining] = useState<GhiCaseInsurer | null>(null);
  const [results, setResults] = useState<DispatchGhiRfqResponse['results'] | null>(null);
  const open = record.stage !== 'CLOSED';
  const approved = state.current?.status === 'APPROVED' && !state.current.stale;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <CardTitle>Insurers</CardTitle>
          <CardDescription>
            Up to {MAX_GHI_INSURERS} insurers. Each gets its own mail, to its RFQ addresses from the
            insurer master only.
          </CardDescription>
        </div>
        {open ? (
          <div className="flex flex-wrap gap-2">
            {canEdit ? (
              <Button type="button" variant="outline" onClick={() => setDialog('choose')}>
                <Users aria-hidden="true" />
                Choose insurers
              </Button>
            ) : null}
            {canSend && record.insurers.length > 0 ? (
              state.mailEnabled ? (
                <Button type="button" disabled={!approved} onClick={() => setDialog('send')}>
                  <Send aria-hidden="true" />
                  Email the RFQ
                </Button>
              ) : (
                <Button type="button" disabled={!approved} onClick={() => setDialog('outside')}>
                  Mark as sent outside the app
                </Button>
              )
            ) : null}
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="grid gap-4">
        {!approved && record.insurers.length > 0 && open ? (
          <p className="text-sm text-muted-foreground">
            The RFQ goes to insurers once its latest version is approved.
          </p>
        ) : null}
        {!state.mailEnabled ? (
          <Alert variant="info">
            <CircleAlert aria-hidden="true" />
            <AlertTitle>Sending mail is turned off on this server</AlertTitle>
            <AlertDescription>
              Download the RFQ, send it yourself, then mark it as sent outside the app.
            </AlertDescription>
          </Alert>
        ) : null}
        {results ? <SendResults results={results} /> : null}
        {record.insurers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No insurer chosen yet.</p>
        ) : (
          <div
            role="region"
            aria-label="Insurers on the case"
            tabIndex={0}
            className="overflow-x-auto rounded-md border"
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Insurer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Quote due</TableHead>
                  <TableHead>Last mail</TableHead>
                  {canEdit && open ? (
                    <TableHead>
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {record.insurers.map((insurer) => (
                  <TableRow key={insurer.insurerId}>
                    <TableCell>
                      <div className="grid">
                        <span>
                          {insurer.company}, {insurer.branch}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {insurer.rfqEmails.join(', ') || 'No RFQ address'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[insurer.status]}>
                        {GHI_INSURER_STATUS_LABELS[insurer.status]}
                      </Badge>
                      {insurer.declineReason ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {insurer.declineReason}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="tabular">
                      {insurer.sentAt
                        ? `${formatDateTime(insurer.sentAt)}${insurer.sentVia === 'OUTSIDE' ? ' (outside the app)' : ''}`
                        : '—'}
                    </TableCell>
                    <TableCell className="tabular">
                      {insurer.dueDate ? formatDate(insurer.dueDate) : '—'}
                    </TableCell>
                    <TableCell>
                      {insurer.lastDispatch ? (
                        <span
                          className={
                            insurer.lastDispatch.result === 'FAILED'
                              ? 'text-destructive'
                              : undefined
                          }
                        >
                          {insurer.lastDispatch.result === 'FAILED'
                            ? `Failed: ${insurer.lastDispatch.error ?? ''}`
                            : insurer.lastDispatch.result === 'OUTBOX'
                              ? 'Kept in the outbox (not delivered)'
                              : 'Delivered to the mail server'}
                        </span>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    {canEdit && open ? (
                      <TableCell>
                        {insurer.status === 'SENT' ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeclining(insurer)}
                          >
                            Record decline
                          </Button>
                        ) : null}
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      {dialog === 'choose' ? (
        <ChooseInsurers record={record} onClose={() => setDialog(null)} />
      ) : null}
      {dialog === 'send' ? (
        <SendRfq
          record={record}
          mode="email"
          onClose={(sent) => {
            setDialog(null);
            if (sent) setResults(sent);
          }}
        />
      ) : null}
      {dialog === 'outside' ? (
        <SendRfq record={record} mode="outside" onClose={() => setDialog(null)} />
      ) : null}
      {declining ? (
        <DeclineDialog record={record} insurer={declining} onClose={() => setDeclining(null)} />
      ) : null}
    </Card>
  );
}

function SendResults({ results }: { results: DispatchGhiRfqResponse['results'] }) {
  const failed = results.filter((result) => result.outcome === 'FAILED');
  return (
    <Alert variant={failed.length > 0 ? 'warning' : 'success'} role="status">
      <Mail aria-hidden="true" />
      <AlertTitle>
        {results.length - failed.length} of {results.length} RFQ mail(s) sent
      </AlertTitle>
      <AlertDescription>
        <ul className="grid gap-0.5">
          {results.map((result) => (
            <li key={result.insurerId ?? result.recipient}>
              {result.recipient}:{' '}
              {result.outcome === 'SENT'
                ? result.result === 'OUTBOX'
                  ? 'kept in the outbox (not delivered)'
                  : 'sent'
                : `not sent — ${result.reason ?? 'failed'}. It stays Not sent; try again.`}
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}

function ChooseInsurers({ record, onClose }: { record: WorkflowCase; onClose: () => void }) {
  const [chosen, setChosen] = useState<string[]>(
    record.insurers.map((insurer) => insurer.insurerId),
  );
  const insurers = useQuery({
    queryKey: ['insurers', 'list', { active: true, ghi: true }],
    queryFn: ({ signal }) =>
      apiFetch('insurers?active=true&limit=100', { schema: InsurerListResponseSchema, signal }),
  });
  const save = useGhiMutation(
    record.id,
    () =>
      apiFetch(`${caseApi(record.product, record.id)}/insurers`, {
        method: 'PUT',
        body: { insurerIds: chosen },
        schema: AnyRecordSchema,
      }),
    () => ({ title: 'Insurers saved' }),
  );
  const fixed = new Set(
    record.insurers
      .filter((insurer) => insurer.status !== 'NOT_SENT')
      .map((insurer) => insurer.insurerId),
  );
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Choose insurers</DialogTitle>
          <DialogDescription>
            Up to {MAX_GHI_INSURERS}. An insurer that already has the RFQ stays on the case.
          </DialogDescription>
        </DialogHeader>
        {insurers.isPending ? (
          <LoadingState label="Loading insurers" />
        ) : insurers.isError ? (
          <ErrorState error={insurers.error} onRetry={() => void insurers.refetch()} />
        ) : (
          <ul className="grid max-h-80 gap-1 overflow-y-auto">
            {insurers.data.items.map((insurer) => {
              const checked = chosen.includes(insurer.id);
              const id = `ghi-insurer-${insurer.id}`;
              return (
                <li key={insurer.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    id={id}
                    checked={checked}
                    disabled={
                      fixed.has(insurer.id) || (!checked && chosen.length >= MAX_GHI_INSURERS)
                    }
                    onCheckedChange={(value) =>
                      setChosen((current) =>
                        value
                          ? [...current, insurer.id]
                          : current.filter((item) => item !== insurer.id),
                      )
                    }
                  />
                  <Label htmlFor={id} className="font-normal">
                    {insurer.company}, {insurer.branch}
                  </Label>
                </li>
              );
            })}
          </ul>
        )}
        {save.isError ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>
              {issuesText(save.error) ?? errorMessage(save.error)}
            </AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <span className="mr-auto text-sm text-muted-foreground tabular">
            {chosen.length} of {MAX_GHI_INSURERS} chosen
          </span>
          <Button
            type="button"
            disabled={save.isPending}
            onClick={() => save.mutate(undefined, { onSuccess: onClose })}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SendRfq({
  record,
  mode,
  onClose,
}: {
  record: WorkflowCase;
  mode: 'email' | 'outside';
  onClose: (results: DispatchGhiRfqResponse['results'] | null) => void;
}) {
  const [chosen, setChosen] = useState<string[]>(
    record.insurers
      .filter((insurer) => insurer.status === 'NOT_SENT')
      .map((insurer) => insurer.insurerId),
  );
  const [dueDate, setDueDate] = useState(record.dueDate);
  const [format, setFormat] = useState<'xlsx' | 'pdf'>('pdf');
  // A new id for each send, so a repeated request mails nobody twice.
  const [sendId] = useState(() => crypto.randomUUID());
  const send = useGhiMutation(
    record.id,
    () =>
      mode === 'email'
        ? apiFetch(`${caseApi(record.product, record.id)}/rfq/email`, {
            method: 'POST',
            body: { sendId, insurerIds: chosen, dueDate, format },
            schema: z.object({ results: z.array(GhiSendOutcomeSchema) }).passthrough(),
          }).then((response) => response.results)
        : apiFetch(`${caseApi(record.product, record.id)}/rfq/sent`, {
            method: 'POST',
            body: { insurerIds: chosen, dueDate },
            schema: AnyRecordSchema,
          }).then(() => null),
    (results) => (results ? null : { title: 'RFQ marked as sent' }),
  );
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose(null))}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === 'email' ? 'Email the RFQ' : 'Mark the RFQ as sent outside the app'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'email'
              ? 'One mail per insurer with the approved RFQ attached. An insurer is Sent only if its mail is accepted.'
              : 'Only for an RFQ you sent yourself.'}
          </DialogDescription>
        </DialogHeader>
        <fieldset className="grid gap-1">
          <legend className="mb-1 text-sm font-medium">Insurers</legend>
          {record.insurers.map((insurer) => {
            const id = `ghi-send-${insurer.insurerId}`;
            return (
              <div key={insurer.insurerId} className="flex items-center gap-2 text-sm">
                <Checkbox
                  id={id}
                  checked={chosen.includes(insurer.insurerId)}
                  onCheckedChange={(value) =>
                    setChosen((current) =>
                      value
                        ? [...current, insurer.insurerId]
                        : current.filter((item) => item !== insurer.insurerId),
                    )
                  }
                />
                <Label htmlFor={id} className="font-normal">
                  {insurer.company}, {insurer.branch} ({GHI_INSURER_STATUS_LABELS[insurer.status]})
                </Label>
              </div>
            );
          })}
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Quote needed by">
            <Input
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
          </Field>
          {mode === 'email' ? (
            <Field label="Attach as">
              <NativeSelect
                value={format}
                onChange={(event) => setFormat(event.target.value as 'xlsx' | 'pdf')}
              >
                <option value="pdf">PDF</option>
                <option value="xlsx">Excel</option>
              </NativeSelect>
            </Field>
          ) : null}
        </div>
        {send.isError ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>
              {issuesText(send.error) ?? errorMessage(send.error)}
            </AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button
            type="button"
            disabled={send.isPending || chosen.length === 0 || !dueDate}
            onClick={() => send.mutate(undefined, { onSuccess: (results) => onClose(results) })}
          >
            {send.isPending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
            {mode === 'email' ? `Send to ${chosen.length}` : 'Mark as sent'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeclineDialog({
  record,
  insurer,
  onClose,
}: {
  record: WorkflowCase;
  insurer: GhiCaseInsurer;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const decline = useGhiMutation(
    record.id,
    () =>
      apiFetch(`${caseApi(record.product, record.id)}/insurers/${insurer.insurerId}/decline`, {
        method: 'POST',
        body: { reason },
        schema: AnyRecordSchema,
      }),
    () => ({ title: 'Decline recorded' }),
  );
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{insurer.company} declined</DialogTitle>
          <DialogDescription>
            Record the insurer’s reason. A quote recorded later moves it back to Quoted.
          </DialogDescription>
        </DialogHeader>
        <Field label="Reason">
          <Textarea
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>
        {decline.isError ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{errorMessage(decline.error)}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button
            type="button"
            disabled={decline.isPending || !reason.trim()}
            onClick={() => decline.mutate(undefined, { onSuccess: onClose })}
          >
            Record decline
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Every RFQ or QCR mail tried for the case, with what the mail server said. */
export function DispatchLog({ dispatches, title }: { dispatches: GhiDispatch[]; title: string }) {
  if (dispatches.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          role="region"
          aria-label={title}
          tabIndex={0}
          className="overflow-x-auto rounded-md border"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Attachment</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dispatches.map((dispatch) => (
                <TableRow key={dispatch.id}>
                  <TableCell className="tabular">{formatDateTime(dispatch.at)}</TableCell>
                  <TableCell>
                    {dispatch.recipient}
                    <span className="block text-xs text-muted-foreground">
                      {dispatch.to.join(', ')}
                    </span>
                  </TableCell>
                  <TableCell>{dispatch.attachment ?? '—'}</TableCell>
                  <TableCell>
                    {dispatch.result === 'FAILED' ? (
                      <Badge variant="destructive">
                        Failed{dispatch.error ? `: ${dispatch.error}` : ''}
                      </Badge>
                    ) : dispatch.result === 'OUTBOX' ? (
                      <Badge variant="warning">Outbox (not delivered)</Badge>
                    ) : (
                      <Badge variant="success">Delivered</Badge>
                    )}
                  </TableCell>
                  <TableCell>{dispatch.by}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
