'use client';

import { LoaderCircle } from 'lucide-react';
import { useId, useState } from 'react';
import { errorMessage } from '@/components/states';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
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
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api-client';
import { issuesText, useGhiMutation } from '@/lib/api/ghi';
import { todayIst } from '@/lib/dates';
import { GhiQcrSchema, GhiSendOutcomeSchema, type GhiCaseRecord, type GhiQcr } from '@/shared';
import { z } from 'zod';
import { Field } from './case-actions';
import { FilePicker, inr } from './ghi-ui';

const SendResponseSchema = z.object({ result: GhiSendOutcomeSchema, qcr: GhiQcrSchema });

/** Mails the approved QCR to the client's contacts from the client master (never a typed address). */
export function SendQcrDialog({
  record,
  qcr,
  onClose,
}: {
  record: GhiCaseRecord;
  qcr: GhiQcr;
  onClose: () => void;
}) {
  const [to, setTo] = useState<string[]>(
    record.client.contacts.slice(0, 1).map((contact) => contact.email),
  );
  const [format, setFormat] = useState<'pdf' | 'xlsx'>('pdf');
  // A new send id for each try, so a repeated request mails nobody twice but Try again does send.
  const [sendId, setSendId] = useState(() => crypto.randomUUID());
  const send = useGhiMutation(
    record.id,
    () =>
      apiFetch(`ghi/cases/${record.id}/qcrs/${qcr.id}/email`, {
        method: 'POST',
        body: { sendId, to, format },
        schema: SendResponseSchema,
      }),
    (response) =>
      response.result.outcome === 'SENT'
        ? {
            title: 'QCR emailed to the client',
            description:
              response.result.result === 'OUTBOX'
                ? 'Kept in the outbox: not delivered (development mail).'
                : to.join(', '),
          }
        : null,
  );
  const failed = send.data?.result.outcome === 'FAILED' ? send.data.result.reason : null;
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Email QCR v{qcr.version} to the client</DialogTitle>
          <DialogDescription>To the client’s contacts in the client master.</DialogDescription>
        </DialogHeader>
        {record.client.contacts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            The client has no contact with an email in the client master.
          </p>
        ) : (
          <fieldset className="grid gap-1">
            <legend className="mb-1 text-sm font-medium">To</legend>
            {record.client.contacts.map((contact) => {
              const id = `qcr-to-${contact.email}`;
              return (
                <div key={contact.email} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    id={id}
                    checked={to.includes(contact.email)}
                    onCheckedChange={(value) =>
                      setTo((current) =>
                        value
                          ? [...current, contact.email]
                          : current.filter((item) => item !== contact.email),
                      )
                    }
                  />
                  <Label htmlFor={id} className="font-normal">
                    {contact.name} ({contact.email})
                  </Label>
                </div>
              );
            })}
          </fieldset>
        )}
        <Field label="Attach as">
          <NativeSelect
            value={format}
            onChange={(event) => setFormat(event.target.value as 'pdf' | 'xlsx')}
          >
            <option value="pdf">PDF</option>
            <option value="xlsx">Excel</option>
          </NativeSelect>
        </Field>
        {send.isError || failed ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>
              {failed
                ? `Not sent: ${failed}`
                : (issuesText(send.error) ?? errorMessage(send.error))}
            </AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button
            type="button"
            disabled={send.isPending || to.length === 0}
            onClick={() =>
              send.mutate(undefined, {
                onSuccess: (response) => {
                  if (response.result.outcome === 'SENT') onClose();
                  else setSendId(crypto.randomUUID());
                },
              })
            }
          >
            {send.isPending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
            {failed ? 'Try again' : 'Send'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Records the client's decision on the approved QCR and the insurer they chose. */
export function ClientDecisionDialog({
  record,
  qcr,
  onClose,
}: {
  record: GhiCaseRecord;
  qcr: GhiQcr;
  onClose: () => void;
}) {
  const previous = qcr.clientDecision;
  const [decision, setDecision] = useState<'ACCEPTED' | 'REJECTED'>(
    previous?.decision ?? 'ACCEPTED',
  );
  const [insurerId, setInsurerId] = useState<string>(
    previous?.insurerId ?? qcr.recommendedInsurerId ?? qcr.columns[0]?.insurerId ?? '',
  );
  const [decidedOn, setDecidedOn] = useState(previous?.decidedOn ?? todayIst());
  const [confirmedBy, setConfirmedBy] = useState(
    previous?.confirmedBy ?? record.client.contacts[0]?.name ?? '',
  );
  const [note, setNote] = useState(previous?.note ?? '');
  const [fileIds, setFileIds] = useState<string[]>(previous?.files.map((file) => file.id) ?? []);
  const contactsId = useId();
  const save = useGhiMutation(
    record.id,
    () =>
      apiFetch(`ghi/cases/${record.id}/qcrs/${qcr.id}/client-decision`, {
        method: 'POST',
        body: {
          decision,
          insurerId: decision === 'ACCEPTED' ? insurerId : null,
          decidedOn,
          confirmedBy,
          note,
          fileIds,
        },
        schema: GhiQcrSchema,
      }),
    () =>
      decision === 'ACCEPTED'
        ? {
            title: 'Client’s acceptance recorded',
            description: 'Record the final agreed terms next.',
          }
        : { title: 'Client’s rejection recorded', description: 'Prepare a new QCR version.' },
  );
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>The client’s decision on QCR v{qcr.version}</DialogTitle>
          <DialogDescription>
            Accepting moves the case to Final QCR; a rejection sends it back for a new QCR.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <fieldset className="flex flex-wrap gap-4">
            <legend className="mb-1 text-sm font-medium">Decision</legend>
            {(['ACCEPTED', 'REJECTED'] as const).map((value) => (
              <label key={value} className="flex items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  name="client-decision"
                  checked={decision === value}
                  onChange={() => setDecision(value)}
                  className="size-4 accent-[var(--primary)]"
                />
                {value === 'ACCEPTED' ? 'Accepted' : 'Rejected'}
              </label>
            ))}
          </fieldset>
          {decision === 'ACCEPTED' ? (
            <Field label="Insurer selected">
              <NativeSelect
                value={insurerId}
                onChange={(event) => setInsurerId(event.target.value)}
              >
                {qcr.columns.map((column) => (
                  <option key={column.insurerId} value={column.insurerId}>
                    {column.insurerName} — total {inr(column.totalPremium)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Decided on">
              <Input
                type="date"
                max={todayIst()}
                value={decidedOn}
                onChange={(event) => setDecidedOn(event.target.value)}
              />
            </Field>
            <Field label="Confirmed by">
              <Input
                list={contactsId}
                maxLength={120}
                value={confirmedBy}
                onChange={(event) => setConfirmedBy(event.target.value)}
              />
            </Field>
            <datalist id={contactsId}>
              {record.client.contacts.map((contact) => (
                <option key={contact.email} value={contact.name} />
              ))}
            </datalist>
          </div>
          <Field label={decision === 'REJECTED' ? 'Why the client rejected it' : 'Note (optional)'}>
            <Textarea
              rows={2}
              maxLength={1000}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </Field>
          <FilePicker
            caseId={record.id}
            purpose="CLIENT_DECISION"
            label="The client’s mail or letter (optional)"
            value={fileIds}
            onChange={setFileIds}
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
            disabled={save.isPending}
            onClick={() => save.mutate(undefined, { onSuccess: onClose })}
          >
            {save.isPending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
            Record decision
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
