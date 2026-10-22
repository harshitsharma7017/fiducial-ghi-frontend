'use client';

import { useQuery } from '@tanstack/react-query';
import { LoaderCircle } from 'lucide-react';
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
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { apiFetch } from '@/lib/api-client';
import { useClaimMutation } from '@/lib/api/claims';
import { ClaimDetailSchema, ProposalOwnersResponseSchema, type ClaimDetail } from '@/shared';
import { ClaimDetailsFields, fieldErrorsOf, type ClaimDetailsValues } from './claim-fields';

/** Corrects the claim's details; the timeline records each field's old and new value. */
export function EditClaimDialog({ claim, onClose }: { claim: ClaimDetail; onClose: () => void }) {
  const [values, setValues] = useState<ClaimDetailsValues>({
    hospital: { name: claim.hospital.name, city: claim.hospital.city ?? '' },
    admissionDate: claim.admissionDate,
    dischargeDate: claim.dischargeDate,
    claimType: claim.claimType,
    amountClaimed: claim.amountClaimed,
    // A claim added by a TPA import has no claimant email until staff enter one.
    contactEmail: claim.contactEmail ?? '',
    contactPhone: claim.contactPhone ?? '',
  });
  const save = useClaimMutation(
    () =>
      apiFetch(`claims/${claim.id}`, { method: 'PUT', body: values, schema: ClaimDetailSchema }),
    () => ({ title: 'Claim saved' }),
  );
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit {claim.claimNumber}</DialogTitle>
          <DialogDescription>
            The patient and policy stay as created; the timeline keeps the old values.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate(undefined, { onSuccess: onClose });
          }}
        >
          <ClaimDetailsFields
            value={values}
            onChange={setValues}
            errors={fieldErrorsOf(save.error)}
          />
          {save.isError ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{errorMessage(save.error)}</AlertDescription>
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

/** An Admin assigns the claim to the staff member who will process and move it. */
export function AssignDialog({ claim, onClose }: { claim: ClaimDetail; onClose: () => void }) {
  const [assignedTo, setAssignedTo] = useState(claim.assignedTo?.id ?? '');
  // Staff who may edit cases are the roles that process claims.
  const staff = useQuery({
    queryKey: ['proposals', 'owners'],
    queryFn: ({ signal }) =>
      apiFetch('proposals/owners', { schema: ProposalOwnersResponseSchema, signal }),
  });
  const save = useClaimMutation(
    () =>
      apiFetch(`claims/${claim.id}/assignee`, {
        method: 'PUT',
        body: { assignedTo: assignedTo || null },
        schema: ClaimDetailSchema,
      }),
    (result) => ({
      title: result.assignedTo ? `Assigned to ${result.assignedTo.name}` : 'Assignment removed',
    }),
  );
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign {claim.claimNumber}</DialogTitle>
          <DialogDescription>
            Only the assigned staff member (and Admins) can move the claim.
          </DialogDescription>
        </DialogHeader>
        <Label className="grid gap-1 text-sm font-normal">
          Assigned to
          <NativeSelect value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)}>
            <option value="">Nobody</option>
            {(staff.data?.items ?? []).map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </NativeSelect>
        </Label>
        {save.isError ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{errorMessage(save.error)}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
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
