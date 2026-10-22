'use client';

import { useQuery } from '@tanstack/react-query';
import { CircleAlert, LoaderCircle, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { z } from 'zod';
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
import { caseApi, ghiFileHref, ghiPaymentsQuery, issuesText, useGhiMutation } from '@/lib/api/ghi';
import { ebPaymentsQuery } from '@/lib/eb/api';
import { todayIst } from '@/lib/dates';
import {
  GHI_PAYMENT_MODES,
  GHI_PAYMENT_MODE_LABELS,
  GHI_PAYMENT_STATUSES,
  GHI_PAYMENT_STATUS_LABELS,
  formatDate,
  type EbProduct,
  type GhiCaseRecord,
  type GhiPayment,
  type SaveGhiPaymentRequest,
} from '@/shared';
import { Field } from './case-actions';
import { Fact, FilePicker, inr } from './ghi-ui';

const STATUS_VARIANT = { PENDING: 'warning', RECEIVED: 'success', FAILED: 'destructive' } as const;

/** GMC answers with "settled", GPA and GTLI with "covered". */
const PaymentsResultSchema = z
  .object({
    outstanding: z.string().nullable(),
    settled: z.boolean().optional(),
    covered: z.boolean().optional(),
  })
  .passthrough();

/** What the payments panel needs of a case, whatever its product. */
type PaymentCase = Pick<GhiCaseRecord, 'id' | 'stage' | 'placed'> & { product: EbProduct };

/** GMC's and GPA/GTLI's payment lists, read the same way. */
function usePayments(record: PaymentCase) {
  const gmc = useQuery({ ...ghiPaymentsQuery(record.id), enabled: record.product === 'GMC' });
  const eb = useQuery({
    ...ebPaymentsQuery(record.product, record.id),
    enabled: record.product !== 'GMC',
  });
  if (record.product === 'GMC') return gmc;
  return {
    ...eb,
    data: eb.data
      ? {
          expected: eb.data.agreedPremium,
          received: eb.data.received,
          pending: eb.data.pending,
          outstanding: eb.data.outstanding,
          settled: eb.data.covered,
          items: eb.data.items,
        }
      : undefined,
  } as typeof gmc;
}

/**
 * Premium payments against the final agreed premium (G7), or for GPA and GTLI against the agreed
 * premium of the client's decision (Requirement 10).
 */
export function PaymentsPanel({ record }: { record: PaymentCase }) {
  const canEdit = usePermission('proposals.edit');
  const payments = usePayments(record);
  const [editing, setEditing] = useState<GhiPayment | 'new' | null>(null);
  const gmc = record.product === 'GMC';
  if (payments.isPending) return <LoadingState label="Loading payments" />;
  if (payments.isError)
    return <ErrorState error={payments.error} onRetry={() => void payments.refetch()} />;
  const data = payments.data;
  if (data.expected === null) {
    return (
      <Alert variant="info">
        <CircleAlert aria-hidden="true" />
        <AlertTitle>{gmc ? 'No final premium yet' : 'No agreed premium yet'}</AlertTitle>
        <AlertDescription>
          {gmc
            ? 'Record the final QCR first: payments are made against its total premium.'
            : 'Record the client’s acceptance of the approved QCR first: payments are made against the agreed premium.'}
        </AlertDescription>
      </Alert>
    );
  }
  const writable = canEdit && record.stage !== 'CLOSED' && !record.placed;
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <CardTitle className="flex items-center gap-2">
            Premium payment{' '}
            {data.settled ? (
              <Badge variant="success">Settled</Badge>
            ) : (
              <Badge variant="warning">Outstanding</Badge>
            )}
          </CardTitle>
          <CardDescription>
            Once received payments cover the final premium, the case moves to Placement Slip.
          </CardDescription>
        </div>
        {writable ? (
          <Button type="button" onClick={() => setEditing('new')}>
            <Plus aria-hidden="true" />
            Record a payment
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="grid gap-4">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
          <Fact label={gmc ? 'Final premium' : 'Agreed premium'}>{inr(data.expected)}</Fact>
          <Fact label="Received">{inr(data.received)}</Fact>
          <Fact label="Pending">{inr(data.pending)}</Fact>
          <Fact label="Outstanding">{inr(data.outstanding)}</Fact>
        </dl>
        {data.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payment recorded yet.</p>
        ) : (
          <div
            role="region"
            aria-label="Payments"
            tabIndex={0}
            className="overflow-x-auto rounded-md border"
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Proof</TableHead>
                  {writable ? (
                    <TableHead>
                      <span className="sr-only">Edit</span>
                    </TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="tabular">{formatDate(payment.paidOn)}</TableCell>
                    <TableCell>
                      {payment.reference}
                      {payment.payer ? (
                        <span className="block text-xs text-muted-foreground">{payment.payer}</span>
                      ) : null}
                    </TableCell>
                    <TableCell>{GHI_PAYMENT_MODE_LABELS[payment.mode]}</TableCell>
                    <TableCell className="text-right tabular">{inr(payment.amount)}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[payment.status]}>
                        {GHI_PAYMENT_STATUS_LABELS[payment.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {payment.files.map((file) => (
                        <a
                          key={file.id}
                          className="mr-2 text-accent-strong hover:underline"
                          href={ghiFileHref(record.id, file.id, record.product)}
                        >
                          {file.fileName}
                        </a>
                      ))}
                    </TableCell>
                    {writable ? (
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit payment ${payment.reference}`}
                          onClick={() => setEditing(payment)}
                        >
                          <Pencil aria-hidden="true" />
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      {editing ? (
        <PaymentDialog
          record={record}
          payment={editing === 'new' ? null : editing}
          outstanding={data.outstanding}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </Card>
  );
}

function PaymentDialog({
  record,
  payment,
  outstanding,
  onClose,
}: {
  record: PaymentCase;
  payment: GhiPayment | null;
  outstanding: string | null;
  onClose: () => void;
}) {
  const [values, setValues] = useState<SaveGhiPaymentRequest>(() =>
    payment
      ? {
          amount: payment.amount,
          paidOn: payment.paidOn,
          reference: payment.reference,
          mode: payment.mode,
          status: payment.status,
          payer: payment.payer,
          note: payment.note,
          fileIds: payment.files.map((file) => file.id),
        }
      : {
          amount: outstanding ?? '',
          paidOn: todayIst(),
          reference: '',
          mode: 'NEFT',
          status: 'RECEIVED',
          payer: null,
          note: null,
          fileIds: [],
        },
  );
  const set = (patch: Partial<SaveGhiPaymentRequest>) =>
    setValues((current) => ({ ...current, ...patch }));
  const save = useGhiMutation(
    record.id,
    () =>
      apiFetch(
        payment
          ? `${caseApi(record.product, record.id)}/payments/${payment.id}`
          : `${caseApi(record.product, record.id)}/payments`,
        {
          method: payment ? 'PUT' : 'POST',
          body: values,
          schema: PaymentsResultSchema,
        },
      ),
    (result) => ({
      title: payment ? 'Payment saved' : 'Payment recorded',
      description:
        (result.settled ?? result.covered)
          ? 'The premium is covered: issue the placement slip.'
          : `Outstanding ${inr(result.outstanding)}.`,
    }),
  );
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{payment ? 'Edit payment' : 'Record a payment'}</DialogTitle>
          <DialogDescription>
            Amounts in rupees with paise. A pending (post-dated) cheque can be dated ahead.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate(undefined, { onSuccess: onClose });
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Amount (₹)">
              <Input
                inputMode="decimal"
                value={values.amount}
                onChange={(event) => set({ amount: event.target.value })}
              />
            </Field>
            <Field label="Date">
              <Input
                type="date"
                value={values.paidOn}
                onChange={(event) => set({ paidOn: event.target.value })}
              />
            </Field>
            <Field label="Cheque / transaction reference">
              <Input
                maxLength={100}
                value={values.reference}
                onChange={(event) => set({ reference: event.target.value })}
              />
            </Field>
            <Field label="Mode">
              <NativeSelect
                value={values.mode}
                onChange={(event) =>
                  set({ mode: event.target.value as SaveGhiPaymentRequest['mode'] })
                }
              >
                {GHI_PAYMENT_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {GHI_PAYMENT_MODE_LABELS[mode]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Status">
              <NativeSelect
                value={values.status}
                onChange={(event) =>
                  set({ status: event.target.value as SaveGhiPaymentRequest['status'] })
                }
              >
                {GHI_PAYMENT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {GHI_PAYMENT_STATUS_LABELS[status]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Paid by (optional)">
              <Input
                maxLength={200}
                value={values.payer ?? ''}
                onChange={(event) => set({ payer: event.target.value })}
              />
            </Field>
          </div>
          <Field label="Note (optional)">
            <Textarea
              rows={2}
              maxLength={1000}
              value={values.note ?? ''}
              onChange={(event) => set({ note: event.target.value })}
            />
          </Field>
          <FilePicker
            caseId={record.id}
            product={record.product}
            purpose="PAYMENT"
            label="Payment proof (optional)"
            value={values.fileIds}
            onChange={(fileIds) => set({ fileIds })}
          />
          {save.isError ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>
                {issuesText(save.error) ?? errorMessage(save.error)}
              </AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
              Save payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
