'use client';

import { useQuery } from '@tanstack/react-query';
import { LoaderCircle, Pencil, XCircle } from 'lucide-react';
import { useState } from 'react';
import { errorMessage } from '@/components/states';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api-client';
import { AnyRecordSchema, caseApi, issuesText, useGhiMutation } from '@/lib/api/ghi';
import {
  ProposalOwnersResponseSchema,
  type GhiCaseRecord,
  type EbProduct,
  type UpdateGhiCaseRequest,
} from '@/shared';

/** The case's own controls: its details (dates, staff, expiring policy) and closing it. */
/** What the case actions need, whatever the product (GPA and GTLI use them too). */
type ActionCase = Pick<
  GhiCaseRecord,
  | 'id'
  | 'reference'
  | 'type'
  | 'stage'
  | 'placed'
  | 'locked'
  | 'owner'
  | 'policyStart'
  | 'policyEnd'
  | 'dueDate'
  | 'existingInsurer'
  | 'existingPolicyNumber'
> & { product: EbProduct };

export function CaseActions({ record }: { record: ActionCase }) {
  if (record.stage === 'CLOSED') return null;
  return (
    <div className="flex flex-wrap gap-2">
      <EditDetails record={record} />
      {record.placed ? null : <CloseCase record={record} />}
    </div>
  );
}

function EditDetails({ record }: { record: ActionCase }) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<UpdateGhiCaseRequest>(() => detailsOf(record));
  const owners = useQuery({
    queryKey: ['proposals', 'owners'],
    queryFn: ({ signal }) =>
      apiFetch('proposals/owners', { schema: ProposalOwnersResponseSchema, signal }),
    enabled: open,
  });
  const save = useGhiMutation(
    record.id,
    (body: UpdateGhiCaseRequest) =>
      apiFetch(`${caseApi(record.product, record.id)}`, {
        method: 'PUT',
        body,
        schema: AnyRecordSchema,
      }),
    () => ({ title: 'Case details saved' }),
  );
  const set = (patch: Partial<UpdateGhiCaseRequest>) =>
    setValues((current) => ({ ...current, ...patch }));
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setValues(detailsOf(record));
          save.reset();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Pencil aria-hidden="true" />
          Edit details
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Case details</DialogTitle>
          <DialogDescription>
            {record.locked
              ? 'The RFQ has gone out, so the policy start (which ages are worked out on) stays as sent.'
              : 'The policy start is the date ages are worked out on, unless the Data Sheet sets another.'}
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate(values, { onSuccess: () => setOpen(false) });
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Policy period from">
              <Input
                type="date"
                value={values.policyStart ?? ''}
                onChange={(event) => set({ policyStart: event.target.value })}
              />
            </Field>
            <Field label="Policy period to">
              <Input
                type="date"
                value={values.policyEnd ?? ''}
                onChange={(event) => set({ policyEnd: event.target.value })}
              />
            </Field>
            <Field label="Quotes needed by">
              <Input
                type="date"
                value={values.dueDate}
                onChange={(event) => set({ dueDate: event.target.value })}
              />
            </Field>
            <Field label="Assigned to">
              <NativeSelect
                value={values.ownerId}
                onChange={(event) => set({ ownerId: event.target.value })}
              >
                {(
                  owners.data?.items ?? [
                    { id: record.owner.id, name: record.owner.name, email: '' },
                  ]
                ).map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {owner.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            {record.type === 'RENEWAL' ? (
              <>
                <Field label="Expiring policy’s insurer">
                  <Input
                    value={values.existingInsurer ?? ''}
                    onChange={(event) => set({ existingInsurer: event.target.value })}
                  />
                </Field>
                <Field label="Expiring policy number">
                  <Input
                    value={values.existingPolicyNumber ?? ''}
                    onChange={(event) => set({ existingPolicyNumber: event.target.value })}
                  />
                </Field>
              </>
            ) : null}
          </div>
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
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function detailsOf(record: ActionCase): UpdateGhiCaseRequest {
  return {
    ownerId: record.owner.id,
    policyStart: record.policyStart ?? '',
    policyEnd: record.policyEnd ?? '',
    dueDate: record.dueDate,
    existingInsurer: record.existingInsurer ?? '',
    existingPolicyNumber: record.existingPolicyNumber ?? '',
  };
}

function CloseCase({ record }: { record: ActionCase }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const close = useGhiMutation(
    record.id,
    (text: string) =>
      apiFetch(`${caseApi(record.product, record.id)}/close`, {
        method: 'POST',
        body: { reason: text },
        schema: AnyRecordSchema,
      }),
    () => ({ title: 'Case closed' }),
  );
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <XCircle aria-hidden="true" />
          Close case
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Close {record.reference}</DialogTitle>
          <DialogDescription>A closed case is kept, read-only, with its reason.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            close.mutate(reason, { onSuccess: () => setOpen(false) });
          }}
        >
          <Field label="Why is it closed?">
            <Textarea
              rows={3}
              maxLength={300}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </Field>
          {close.isError ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>
                {issuesText(close.error) ?? errorMessage(close.error)}
              </AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button
              type="submit"
              variant="destructive"
              disabled={close.isPending || !reason.trim()}
            >
              Close the case
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactElement;
  hint?: string;
}) {
  return (
    <Label className="grid gap-1 text-sm font-normal">
      <span>{label}</span>
      {children}
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </Label>
  );
}
