'use client';

import { useQuery } from '@tanstack/react-query';
import { Mail } from 'lucide-react';
import { ErrorState, LoadingState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiFetch } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { MailStatusSchema, type MailTransportName } from '@/shared';

const TRANSPORT: Record<
  MailTransportName,
  { label: string; variant: 'success' | 'warning' | 'muted'; explanation: string }
> = {
  smtp: {
    label: 'Sending',
    variant: 'success',
    explanation: 'RFQs and reminders are delivered through the mail server below.',
  },
  outbox: {
    label: 'Outbox only',
    variant: 'warning',
    explanation:
      'Mails are kept in each case’s mail log but never delivered. Use this for testing; set MAIL_TRANSPORT=smtp to send.',
  },
  off: {
    label: 'Off',
    variant: 'muted',
    explanation:
      'The app does not send mail. Users email the RFQ themselves and mark it “Sent outside the app”. Set MAIL_TRANSPORT and the SMTP settings to turn it on.',
  },
};

/** How the API sends mail (settings.view). The SMTP user and password are never shown. */
export function MailCard() {
  const status = useQuery({
    queryKey: queryKeys.mailStatus,
    queryFn: ({ signal }) => apiFetch('mail/status', { schema: MailStatusSchema, signal }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="size-4" aria-hidden="true" />
          Mail
        </CardTitle>
        <CardDescription>How RFQs and reminders leave the app.</CardDescription>
      </CardHeader>
      <CardContent>
        {status.isPending ? (
          <LoadingState label="Loading mail settings" />
        ) : status.isError ? (
          <ErrorState error={status.error} onRetry={() => void status.refetch()} />
        ) : (
          <div className="grid gap-3 text-sm">
            <p className="flex items-center gap-2">
              <Badge variant={TRANSPORT[status.data.transport].variant}>
                {TRANSPORT[status.data.transport].label}
              </Badge>
              <span className="text-muted-foreground">{status.data.transport}</span>
            </p>
            <p className="text-muted-foreground">{TRANSPORT[status.data.transport].explanation}</p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              <dt className="text-muted-foreground">From</dt>
              <dd className="break-all">{status.data.from ?? 'Not set'}</dd>
              <dt className="text-muted-foreground">Mail server</dt>
              <dd className="break-all">{status.data.host ?? '—'}</dd>
            </dl>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
