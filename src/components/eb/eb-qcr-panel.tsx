'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleAlert, LoaderCircle, Mail, Send } from 'lucide-react';
import { useState } from 'react';
import { DownloadButton, inr } from '@/components/ghi/ghi-ui';
import { EmptyState, ErrorState, LoadingState, errorMessage } from '@/components/states';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import { toast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api-client';
import { caseApi, refreshGhiCase } from '@/lib/api/ghi';
import { ebQcrsQuery } from '@/lib/eb/api';
import {
  casePermission,
  EbQcrSchema,
  EbQcrSendResponseSchema,
  formatDateTime,
  GHI_QCR_STATUS_LABELS,
  type EbCaseRecord,
  type EbQcr,
} from '@/shared';
import { ClientDecisionPanel } from './client-decision-panel';
import { Field } from './eb-ui';

/**
 * The GPA and GTLI QCR (Requirement 8): each insurer’s latest recorded quote, every lowest total
 * marked, approved by an approver against the exact content shown (its fingerprint), then mailed
 * to the company’s contacts. The client’s decision follows on the approved version (9).
 */
export function EbQcrPanel({ record }: { record: EbCaseRecord }) {
  const queryClient = useQueryClient();
  const canEdit = usePermission(casePermission(record.product, 'edit'));
  const canApprove = usePermission(casePermission(record.product, 'approve'));
  const canExport = usePermission(casePermission(record.product, 'export'));
  const canSend = usePermission(casePermission(record.product, 'send'));
  const qcrs = useQuery(ebQcrsQuery(record.product, record.id));
  const [recommended, setRecommended] = useState('');
  const [remarks, setRemarks] = useState('');
  const [comment, setComment] = useState('');
  const base = caseApi(record.product, record.id);
  const refresh = () => refreshGhiCase(queryClient, record.id);
  const create = useMutation({
    mutationFn: () =>
      apiFetch(`${base}/qcrs`, {
        method: 'POST',
        body: { recommendedInsurerId: recommended || null, remarks },
        schema: EbQcrSchema,
      }),
    onSuccess: () => {
      refresh();
      toast({ title: 'QCR prepared', variant: 'success' });
    },
  });
  const act = useMutation({
    mutationFn: ({ path, body }: { path: string; body?: unknown }) =>
      apiFetch(`${base}/qcrs/${path}`, { method: 'POST', body, schema: EbQcrSchema }),
    onSuccess: refresh,
  });
  if (qcrs.isPending) return <LoadingState label="Loading the QCR" />;
  if (qcrs.isError) return <ErrorState error={qcrs.error} onRetry={() => void qcrs.refetch()} />;
  const latest = qcrs.data.items[0] ?? null;
  const open =
    record.stage !== 'CLOSED' &&
    !record.placed &&
    record.stage !== 'PAYMENT' &&
    record.stage !== 'PLACEMENT_SLIP';
  const canPrepare =
    canEdit &&
    open &&
    qcrs.data.candidates.length > 0 &&
    (!latest ||
      latest.status === 'REJECTED' ||
      latest.outOfDate ||
      latest.clientDecision?.decision === 'REJECTED');
  const error = create.error ?? act.error;
  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Quote comparison report</CardTitle>
          <CardDescription>
            {qcrs.data.candidates.length} insurer(s) with a recorded quote that have not declined.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {latest ? (
            <QcrView qcr={latest} />
          ) : (
            <EmptyState title="No QCR yet" description="Record the quotes, then prepare the QCR." />
          )}
          {latest?.outOfDate ? (
            <Alert variant="warning">
              <CircleAlert aria-hidden="true" />
              <AlertTitle>QCR v{latest.version} is out of date</AlertTitle>
              <AlertDescription>
                A compared quote changed since it was submitted. Prepare and approve a new version.
              </AlertDescription>
            </Alert>
          ) : null}
          {canPrepare ? (
            <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-2">
              <Field label="Recommended insurer (optional)">
                <NativeSelect
                  value={recommended}
                  onChange={(event) => setRecommended(event.target.value)}
                >
                  <option value="">None</option>
                  {qcrs.data.candidates.map((quote) => (
                    <option key={quote.insurerId} value={quote.insurerId}>
                      {quote.insurerName}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Remarks (optional)">
                <Textarea
                  rows={2}
                  value={remarks}
                  onChange={(event) => setRemarks(event.target.value)}
                />
              </Field>
              <div>
                <Button type="button" disabled={create.isPending} onClick={() => create.mutate()}>
                  {create.isPending ? (
                    <LoaderCircle className="animate-spin" aria-hidden="true" />
                  ) : null}
                  Prepare QCR v{(latest?.version ?? 0) + 1}
                </Button>
              </div>
            </div>
          ) : null}
          {latest && open ? (
            <div className="flex flex-wrap gap-2">
              {canEdit && latest.status === 'DRAFT' ? (
                <Button type="button" onClick={() => act.mutate({ path: `${latest.id}/submit` })}>
                  <Send aria-hidden="true" />
                  Submit for approval
                </Button>
              ) : null}
              {canExport ? (
                <>
                  <DownloadButton
                    path={`${base}/qcrs/${latest.id}/document?format=xlsx`}
                    fallbackName="QCR.xlsx"
                  >
                    Excel
                  </DownloadButton>
                  <DownloadButton
                    path={`${base}/qcrs/${latest.id}/document?format=pdf`}
                    fallbackName="QCR.pdf"
                  >
                    PDF
                  </DownloadButton>
                </>
              ) : null}
            </div>
          ) : null}
          {latest && open && canApprove && latest.status === 'SUBMITTED' && !latest.outOfDate ? (
            <div className="grid gap-2 rounded-md border p-3">
              <p className="text-sm font-medium">Approve QCR v{latest.version} as shown above</p>
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
                  disabled={act.isPending}
                  onClick={() =>
                    act.mutate({
                      path: `${latest.id}/decision`,
                      body: { decision: 'APPROVED', comment, fingerprint: latest.fingerprint },
                    })
                  }
                >
                  Approve
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={act.isPending || !comment.trim()}
                  onClick={() =>
                    act.mutate({
                      path: `${latest.id}/decision`,
                      body: { decision: 'REJECTED', comment, fingerprint: latest.fingerprint },
                    })
                  }
                >
                  Reject with comment
                </Button>
              </div>
            </div>
          ) : null}
          {error ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{errorMessage(error)}</AlertDescription>
            </Alert>
          ) : null}
          {latest &&
          canSend &&
          latest.status === 'APPROVED' &&
          !latest.outOfDate &&
          record.stage !== 'CLOSED' ? (
            <SendQcr record={record} qcr={latest} mailEnabled={qcrs.data.mailEnabled} />
          ) : null}
        </CardContent>
      </Card>
      {latest && latest.status === 'APPROVED' ? (
        <ClientDecisionPanel record={record} qcr={latest} />
      ) : null}
    </div>
  );
}

function QcrView({ qcr }: { qcr: EbQcr }) {
  return (
    <div className="grid gap-3">
      <p className="flex flex-wrap items-center gap-2 text-sm">
        <Badge
          variant={
            qcr.status === 'APPROVED'
              ? 'success'
              : qcr.status === 'REJECTED'
                ? 'destructive'
                : 'warning'
          }
        >
          v{qcr.version} · {GHI_QCR_STATUS_LABELS[qcr.status]}
        </Badge>
        {qcr.decision ? (
          <span className="text-muted-foreground">
            {qcr.decision.status === 'APPROVED' ? 'Approved' : 'Rejected'} by {qcr.decision.by},{' '}
            {formatDateTime(qcr.decision.at)}
            {qcr.decision.comment ? `: ${qcr.decision.comment}` : ''}
          </span>
        ) : null}
      </p>
      <div
        role="region"
        aria-label={`QCR v${qcr.version}`}
        tabIndex={0}
        className="overflow-x-auto rounded-md border"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Asked</TableHead>
              {qcr.columns.map((column) => (
                <TableHead key={column.quoteId}>
                  {column.insurerName} (v{column.quoteVersion})
                  {column.lowest ? (
                    <Badge variant="success" className="ml-1">
                      Lowest
                    </Badge>
                  ) : null}
                  {column.recommended ? (
                    <Badge variant="accent" className="ml-1">
                      Recommended
                    </Badge>
                  ) : null}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {(['basePremium', 'gst', 'totalPremium'] as const).map((key) => (
              <TableRow key={key}>
                <TableCell>
                  {key === 'basePremium' ? 'Base premium' : key === 'gst' ? 'GST' : 'Total premium'}
                </TableCell>
                <TableCell />
                {qcr.columns.map((column) => (
                  <TableCell key={column.quoteId} className="tabular">
                    {inr(column[key])}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            {qcr.rows.map((row) => (
              <TableRow key={row.key}>
                <TableCell>{row.label}</TableCell>
                <TableCell>{row.requested}</TableCell>
                {row.values.map((value, index) => (
                  <TableCell
                    key={index}
                    className={
                      value.kind === 'DEVIATION'
                        ? 'text-destructive'
                        : value.kind === 'MISSING'
                          ? 'text-warning'
                          : undefined
                    }
                  >
                    {value.text}
                    {value.kind === 'DEVIATION'
                      ? ' (deviation)'
                      : value.kind === 'MISSING'
                        ? ' (missing)'
                        : ''}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {qcr.remarks ? <p className="text-sm">Remarks: {qcr.remarks}</p> : null}
    </div>
  );
}

function SendQcr({
  record,
  qcr,
  mailEnabled,
}: {
  record: EbCaseRecord;
  qcr: EbQcr;
  mailEnabled: boolean;
}) {
  const queryClient = useQueryClient();
  const [to, setTo] = useState<string[]>([]);
  const [sendId] = useState(() => crypto.randomUUID());
  const send = useMutation({
    mutationFn: () =>
      apiFetch(`${caseApi(record.product, record.id)}/qcrs/${qcr.id}/email`, {
        method: 'POST',
        body: { sendId, to, format: 'pdf' },
        schema: EbQcrSendResponseSchema,
      }),
    onSuccess: (outcome) => {
      refreshGhiCase(queryClient, record.id);
      toast({
        title:
          outcome.result.outcome === 'SENT' ? 'QCR emailed to the client' : 'The QCR mail failed',
        description: outcome.result.reason ?? undefined,
        variant: outcome.result.outcome === 'SENT' ? 'success' : 'destructive',
      });
    },
  });
  if (!mailEnabled) {
    return (
      <p className="text-sm text-muted-foreground">
        Mail is turned off on this server: download the QCR and send it yourself.
      </p>
    );
  }
  return (
    <fieldset className="grid gap-2 rounded-md border p-3">
      <legend className="px-1 text-sm font-medium">
        Email the approved QCR to the company’s contacts
      </legend>
      {record.client.contacts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          The company has no contact with an email in the client master.
        </p>
      ) : (
        record.client.contacts.map((contact) => (
          <Label key={contact.email} className="flex items-center gap-2 text-sm font-normal">
            <Checkbox
              checked={to.includes(contact.email)}
              onCheckedChange={(checked) =>
                setTo((current) =>
                  checked
                    ? [...current, contact.email]
                    : current.filter((item) => item !== contact.email),
                )
              }
            />
            {contact.name} ({contact.email})
          </Label>
        ))
      )}
      {send.isError ? <p className="text-xs text-destructive">{errorMessage(send.error)}</p> : null}
      <div>
        <Button
          type="button"
          variant="outline"
          disabled={to.length === 0 || send.isPending}
          onClick={() => send.mutate()}
        >
          <Mail aria-hidden="true" />
          Send to {to.length} contact(s)
        </Button>
      </div>
    </fieldset>
  );
}
