'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CircleCheck, LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { FilePicker, inr } from '@/components/ghi/ghi-ui';
import { errorMessage } from '@/components/states';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { usePermission } from '@/hooks/use-permission';
import { apiFetch } from '@/lib/api-client';
import { caseApi, ghiFileHref, refreshGhiCase } from '@/lib/api/ghi';
import { todayIst } from '@/lib/dates';
import { casePermission, EbQcrSchema, formatDate, type EbCaseRecord, type EbQcr } from '@/shared';
import { AwaitingNote } from './awaiting-confirmation';
import { Field } from './eb-ui';

/**
 * The client's decision on the approved QCR (Requirement 9), within the Approval stage: the
 * chosen insurer sets the agreed premium (that quote version's total), and moves the case to
 * Payment; a rejection sends it back to QCR. A default awaiting the client's confirmation of the
 * workflow (open question 1).
 */
export function ClientDecisionPanel({ record, qcr }: { record: EbCaseRecord; qcr: EbQcr }) {
  const canEdit = usePermission(casePermission(record.product, 'edit'));
  const queryClient = useQueryClient();
  const decision = qcr.clientDecision;
  const [choice, setChoice] = useState<'ACCEPTED' | 'REJECTED'>('ACCEPTED');
  const [insurerId, setInsurerId] = useState(
    qcr.columns.find((column) => column.recommended)?.insurerId ?? '',
  );
  const [decidedOn, setDecidedOn] = useState(todayIst());
  const [confirmedBy, setConfirmedBy] = useState('');
  const [note, setNote] = useState('');
  const [fileIds, setFileIds] = useState<string[]>([]);
  const record$ = useMutation({
    mutationFn: () =>
      apiFetch(`${caseApi(record.product, record.id)}/qcrs/${qcr.id}/client-decision`, {
        method: 'POST',
        body:
          choice === 'ACCEPTED'
            ? {
                decision: choice,
                insurerId,
                decidedOn,
                confirmedBy,
                note,
                fileIds,
                fingerprint: qcr.fingerprint,
              }
            : {
                decision: choice,
                decidedOn,
                confirmedBy,
                reason: note,
                fileIds,
                fingerprint: qcr.fingerprint,
              },
        schema: EbQcrSchema,
      }),
    onSuccess: () => refreshGhiCase(queryClient, record.id),
  });
  const writable =
    canEdit &&
    !record.placed &&
    (record.stage === 'APPROVAL' || record.stage === 'PAYMENT') &&
    !qcr.outOfDate;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Client’s decision</CardTitle>
        <CardDescription>
          <AwaitingNote>
            Recording the client’s decision before payment is a default awaiting the client’s
            confirmation of the workflow (open question 1).
          </AwaitingNote>
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {decision ? (
          <Alert variant={decision.decision === 'ACCEPTED' ? 'success' : 'info'}>
            <CircleCheck aria-hidden="true" />
            <AlertTitle>
              {decision.decision === 'ACCEPTED'
                ? `Accepted: ${decision.insurerName ?? ''}, agreed premium ${inr(decision.agreedPremium)} (quote v${decision.quoteVersion ?? ''})`
                : 'Rejected by the client'}
            </AlertTitle>
            <AlertDescription>
              {formatDate(decision.decidedOn)} · confirmed by {decision.confirmedBy}
              {decision.note ? ` · ${decision.note}` : ''}
              {decision.files.length > 0 ? (
                <span className="block">
                  {decision.files.map((file) => (
                    <a
                      key={file.id}
                      className="mr-3 text-accent-strong hover:underline"
                      href={ghiFileHref(record.id, file.id, record.product)}
                    >
                      {file.fileName}
                    </a>
                  ))}
                </span>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : null}
        {writable ? (
          <form
            noValidate
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              record$.mutate();
            }}
          >
            <Field label="Decision">
              <NativeSelect
                value={choice}
                onChange={(event) => setChoice(event.target.value as 'ACCEPTED' | 'REJECTED')}
              >
                <option value="ACCEPTED">Accepted</option>
                {record.stage === 'APPROVAL' ? <option value="REJECTED">Rejected</option> : null}
              </NativeSelect>
            </Field>
            {choice === 'ACCEPTED' ? (
              <Field label="Insurer chosen">
                <NativeSelect
                  value={insurerId}
                  onChange={(event) => setInsurerId(event.target.value)}
                >
                  <option value="">Choose the insurer</option>
                  {qcr.columns.map((column) => (
                    <option key={column.insurerId} value={column.insurerId}>
                      {column.insurerName} · {inr(column.totalPremium)}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            ) : null}
            <Field label="Date of the decision">
              <Input
                type="date"
                max={todayIst()}
                value={decidedOn}
                onChange={(event) => setDecidedOn(event.target.value)}
              />
            </Field>
            <Field label="Confirmed by (at the client)">
              <Input value={confirmedBy} onChange={(event) => setConfirmedBy(event.target.value)} />
            </Field>
            <Field
              label={choice === 'ACCEPTED' ? 'Note (optional)' : 'Reason'}
              className="sm:col-span-2"
            >
              <Textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
            </Field>
            <div className="sm:col-span-2">
              <FilePicker
                caseId={record.id}
                product={record.product}
                purpose="CLIENT_DECISION"
                label={
                  choice === 'ACCEPTED'
                    ? 'The client’s mail or document (at least one)'
                    : 'The client’s mail (optional)'
                }
                value={fileIds}
                onChange={setFileIds}
              />
            </div>
            {record$.isError ? (
              <Alert variant="destructive" role="alert" className="sm:col-span-2">
                <AlertDescription>{errorMessage(record$.error)}</AlertDescription>
              </Alert>
            ) : null}
            <div className="sm:col-span-2">
              <Button
                type="submit"
                disabled={
                  record$.isPending || !confirmedBy.trim() || (choice === 'ACCEPTED' && !insurerId)
                }
              >
                {record$.isPending ? (
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                ) : null}
                {decision ? 'Replace the decision' : 'Record the decision'}
              </Button>
            </div>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
