'use client';

import { Download, Eye, LoaderCircle, Mail, RotateCw, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { errorMessage } from '@/components/states';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  claimDocumentHref,
  issuesText,
  uploadClaimDocument,
  useClaimMutation,
} from '@/lib/api/claims';
import {
  CLAIM_DOCUMENT_KINDS,
  CLAIM_DOCUMENT_KIND_LABELS,
  CLAIM_DOCUMENT_TYPES,
  CLAIM_EMAIL_AUDIENCE_LABELS,
  CLAIM_NOTIFICATION_STATUS_LABELS,
  CLAIM_STATUS_LABELS,
  ClaimDetailSchema,
  ClaimNotificationSchema,
  formatDateTime,
  type ClaimDetail,
  type ClaimDocumentKind,
  type ClaimNotificationStatus,
} from '@/shared';

const ACCEPT = [...Object.keys(CLAIM_DOCUMENT_TYPES), ...Object.values(CLAIM_DOCUMENT_TYPES)].join(
  ',',
);
const kb = (size: number) => `${Math.max(1, Math.round(size / 1024)).toLocaleString('en-IN')} KB`;

/** The claim's documents, opened through the proxy by staff who may view claims (each opening is logged). */
export function ClaimDocuments({ claim }: { claim: ClaimDetail }) {
  const canOpenDocuments = usePermission('claims.view_documents');
  const [kind, setKind] = useState<ClaimDocumentKind>(claim.missingDocuments[0] ?? 'OTHER');
  const input = useRef<HTMLInputElement>(null);
  const upload = useClaimMutation(
    (file: File) => uploadClaimDocument(claim.id, kind, file),
    (saved) => ({ title: 'Document uploaded', description: saved.fileName }),
  );
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <CardTitle>Documents</CardTitle>
          <CardDescription>
            Medical records: open them only for processing the claim.
          </CardDescription>
        </div>
        {claim.canEdit ? (
          <div className="flex flex-wrap items-end gap-2">
            <Label className="grid gap-1 text-sm font-normal">
              Kind
              <NativeSelect
                className="w-52"
                value={kind}
                onChange={(event) => setKind(event.target.value as ClaimDocumentKind)}
              >
                {CLAIM_DOCUMENT_KINDS.map((value) => (
                  <option key={value} value={value}>
                    {CLAIM_DOCUMENT_KIND_LABELS[value]}
                  </option>
                ))}
              </NativeSelect>
            </Label>
            <input
              ref={input}
              type="file"
              accept={ACCEPT}
              className="sr-only"
              aria-label="Document to upload"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) upload.mutate(file);
                event.target.value = '';
              }}
            />
            <Button
              type="button"
              variant="outline"
              disabled={upload.isPending}
              onClick={() => input.current?.click()}
            >
              {upload.isPending ? (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              ) : (
                <Upload aria-hidden="true" />
              )}
              Upload
            </Button>
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="grid gap-3">
        {upload.isError ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>
              {issuesText(upload.error) ?? errorMessage(upload.error)}
            </AlertDescription>
          </Alert>
        ) : null}
        {claim.documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No documents yet.</p>
        ) : (
          <ul className="grid gap-2">
            {claim.documents.map((doc) => (
              <li
                key={doc.id}
                className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm"
              >
                <span className="grid">
                  <span className="font-medium">{CLAIM_DOCUMENT_KIND_LABELS[doc.kind]}</span>
                  <span className="text-xs text-muted-foreground">
                    {doc.fileName} · {kb(doc.size)} · {doc.uploadedBy},{' '}
                    {formatDateTime(doc.uploadedAt)}
                  </span>
                </span>
                {/* Medical documents: only with claims.view_documents (the API refuses others). */}
                {canOpenDocuments ? (
                  <span className="ml-auto flex gap-1">
                    <Button asChild variant="ghost" size="sm">
                      <a
                        href={claimDocumentHref(claim.id, doc.id, true)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Eye aria-hidden="true" />
                        View
                      </a>
                    </Button>
                    <Button asChild variant="ghost" size="sm">
                      <a href={claimDocumentHref(claim.id, doc.id)}>
                        <Download aria-hidden="true" />
                        Download
                      </a>
                    </Button>
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

const MAIL_VARIANT: Record<
  ClaimNotificationStatus,
  'muted' | 'info' | 'success' | 'warning' | 'destructive'
> = {
  PENDING: 'warning',
  SENDING: 'info',
  ACCEPTED: 'success',
  OUTBOX: 'warning',
  FAILED: 'destructive',
};

/** Every email the claim's moves owed: who, what, and where it stands, with a retry for failures. */
export function ClaimEmails({ claim }: { claim: ClaimDetail }) {
  const canRetry = usePermission('claims.retry_notifications');
  const retry = useClaimMutation(
    (notificationId: string) =>
      apiFetch(`claims/${claim.id}/notifications/${notificationId}/retry`, {
        method: 'POST',
        schema: ClaimNotificationSchema,
      }),
    (result) =>
      result.status === 'FAILED'
        ? null
        : { title: 'Email sent again', description: result.recipient },
  );
  if (claim.notifications.length === 0) return null;
  const failedAgain = retry.data?.status === 'FAILED' ? retry.data.error : null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail aria-hidden="true" className="size-4" />
          Emails
        </CardTitle>
        <CardDescription>
          “Accepted” means the mail server took the email; delivery to the inbox is not confirmed.
          Failed emails are retried automatically up to three times.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {retry.isError || failedAgain ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>
              {failedAgain ? `Still failing: ${failedAgain}` : errorMessage(retry.error)}
            </AlertDescription>
          </Alert>
        ) : null}
        <div
          role="region"
          aria-label="Claim emails"
          tabIndex={0}
          className="overflow-x-auto rounded-md border"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>For the move to</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Result</TableHead>
                <TableHead className="text-right">Tries</TableHead>
                <TableHead>Last try</TableHead>
                {canRetry ? (
                  <TableHead>
                    <span className="sr-only">Retry</span>
                  </TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {claim.notifications.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{CLAIM_STATUS_LABELS[item.toStatus]}</TableCell>
                  <TableCell>
                    {item.recipient}
                    <span className="block text-xs text-muted-foreground">
                      {CLAIM_EMAIL_AUDIENCE_LABELS[item.audience]}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-64">{item.subject}</TableCell>
                  <TableCell>
                    <Badge variant={MAIL_VARIANT[item.status]}>
                      {CLAIM_NOTIFICATION_STATUS_LABELS[item.status]}
                    </Badge>
                    {item.error ? (
                      <span className="mt-1 block text-xs text-destructive">{item.error}</span>
                    ) : null}
                    {item.status === 'PENDING' && item.nextAttemptAt ? (
                      <span className="mt-1 block text-xs text-muted-foreground">
                        Next try {formatDateTime(item.nextAttemptAt)}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right tabular">{item.attempts}</TableCell>
                  <TableCell className="tabular">
                    {item.lastAttemptAt ? formatDateTime(item.lastAttemptAt) : '—'}
                  </TableCell>
                  {canRetry ? (
                    <TableCell>
                      {item.status === 'FAILED' ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={retry.isPending}
                          onClick={() => retry.mutate(item.id)}
                        >
                          <RotateCw aria-hidden="true" />
                          Retry
                        </Button>
                      ) : null}
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

/** The remarks made while processing: with each move, and on their own. */
export function ClaimRemarks({ claim }: { claim: ClaimDetail }) {
  const [remark, setRemark] = useState('');
  const add = useClaimMutation(
    (text: string) =>
      apiFetch(`claims/${claim.id}/remarks`, {
        method: 'POST',
        body: { remark: text },
        schema: ClaimDetailSchema,
      }),
    () => ({ title: 'Remark added' }),
  );
  const remarks = claim.timeline.filter((event) => event.remark !== null).reverse();
  const canRemark = claim.allowedMoves.length > 0 || claim.canEdit;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Remarks</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {canRemark ? (
          <form
            className="grid gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              add.mutate(remark, { onSuccess: () => setRemark('') });
            }}
          >
            <Textarea
              rows={2}
              maxLength={1000}
              aria-label="New remark"
              placeholder="Add a remark"
              value={remark}
              onChange={(event) => setRemark(event.target.value)}
            />
            {add.isError ? (
              <p role="alert" className="text-xs text-destructive">
                {errorMessage(add.error)}
              </p>
            ) : null}
            <Button
              type="submit"
              size="sm"
              className="justify-self-end"
              disabled={add.isPending || !remark.trim()}
            >
              Add remark
            </Button>
          </form>
        ) : null}
        {remarks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No remarks yet.</p>
        ) : (
          <ul className="grid gap-2">
            {remarks.map((event) => (
              <li key={event.id} className="grid gap-0.5 rounded-md border px-3 py-2 text-sm">
                <span className="whitespace-pre-wrap">{event.remark}</span>
                <span className="text-xs text-muted-foreground">
                  {event.actor.name} · {formatDateTime(event.at)}
                  {event.toStatus && event.type === 'STATUS_CHANGED'
                    ? ` · moved to ${CLAIM_STATUS_LABELS[event.toStatus]}`
                    : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** Every event, oldest first: moves with their remarks, edits with old and new values, emails. */
export function ClaimTimeline({ claim }: { claim: ClaimDetail }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Timeline</CardTitle>
        <CardDescription>Kept as it happened: events are never changed.</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="grid gap-3 border-l pl-4" aria-label="Claim timeline">
          {claim.timeline.map((event) => (
            <li key={event.id} className="relative grid gap-0.5 text-sm">
              <span
                aria-hidden="true"
                className={`absolute top-1.5 -left-[1.3rem] size-2.5 rounded-full ${event.type === 'EMAIL_FAILED' ? 'bg-destructive' : event.type === 'STATUS_CHANGED' ? 'bg-primary' : 'bg-muted-foreground'}`}
              />
              <span className="font-medium">{event.description}</span>
              <span className="text-xs text-muted-foreground tabular">
                {event.actor.name} · {formatDateTime(event.at)}
              </span>
              {event.remark ? (
                <span className="whitespace-pre-wrap">Remark: {event.remark}</span>
              ) : null}
              {event.changes.length > 0 ? (
                <ul className="text-xs">
                  {event.changes.map((change) => (
                    <li key={change.field}>
                      {change.field}: {change.before ?? '—'} → {change.after ?? '—'}
                    </li>
                  ))}
                </ul>
              ) : null}
              {event.email ? (
                <span
                  className={`text-xs ${event.email.result === 'FAILED' ? 'text-destructive' : 'text-muted-foreground'}`}
                >
                  {CLAIM_EMAIL_AUDIENCE_LABELS[event.email.audience]} · “{event.email.subject}” ·
                  try {event.email.attempt}
                  {event.email.error ? ` · ${event.email.error}` : ''}
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
