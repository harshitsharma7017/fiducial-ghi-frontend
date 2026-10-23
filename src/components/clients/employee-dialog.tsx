'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { fieldErrorsOf } from '@/components/claims/claim-fields';
import { Field } from '@/components/eb/eb-ui';
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
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api-client';
import { ebKeys } from '@/lib/eb/api';
import {
  EB_PRODUCT_LABELS,
  EbEmployeeChangeResponseSchema,
  GHI_GENDERS,
  GHI_GENDER_LABELS,
  formatDate,
  type EbEmployee,
  type GhiGender,
} from '@/shared';

/**
 * Corrects an employee's own details, or resolves an employee whose cases disagree
 * (Requirements 17.6, 17.11). The change applies to the Self member of every open case of the
 * employee; placed cases keep their snapshot. A reason is required. For an unresolved employee
 * nothing is chosen for the user: they pick a case's details to start from, or type them.
 */
export function EmployeeDialog({
  clientId,
  employee,
  onClose,
}: {
  clientId: string;
  employee: EbEmployee;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const resolving = employee.unresolved;
  const [name, setName] = useState(resolving ? '' : employee.name);
  const [gender, setGender] = useState<GhiGender | ''>(resolving ? '' : employee.gender);
  const [dateOfBirth, setDateOfBirth] = useState(resolving ? '' : (employee.dateOfBirth ?? ''));
  const [reason, setReason] = useState('');
  const save = useMutation({
    mutationFn: () =>
      resolving
        ? apiFetch(`eb/companies/${clientId}/employees/resolve`, {
            method: 'POST',
            body: { employeeKey: employee.employeeKey, name, gender, dateOfBirth, reason },
            schema: EbEmployeeChangeResponseSchema,
          })
        : apiFetch(`eb/companies/${clientId}/employees/${employee.id ?? ''}`, {
            method: 'PUT',
            body: { name, gender, dateOfBirth, reason },
            schema: EbEmployeeChangeResponseSchema,
          }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ebKeys.company(clientId) });
      void queryClient.invalidateQueries({ queryKey: ['ghi'] });
      toast({
        variant: 'success',
        title: resolving ? 'Employee resolved' : 'Employee updated',
        description:
          result.casesChanged.length > 0
            ? `Updated in ${result.casesChanged.map((item) => item.reference).join(', ')}.`
            : 'No open case needed a change.',
      });
      onClose();
    },
  });
  const errors = fieldErrorsOf(save.error);
  const err = (path: string) =>
    errors[path] ? (
      <span className="text-xs text-destructive" role="alert">
        {errors[path]}
      </span>
    ) : null;
  const incomplete = !name.trim() || !gender || !dateOfBirth || !reason.trim();
  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {resolving ? 'Resolve' : 'Update'} employee {employee.employeeId}
          </DialogTitle>
          <DialogDescription>
            The details change on the employee’s Self member in every open case. Placed cases keep
            their snapshot.
          </DialogDescription>
        </DialogHeader>
        <form
          id="employee-form"
          noValidate
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!incomplete) save.mutate();
          }}
        >
          {resolving ? (
            <div className="grid gap-2 text-sm">
              <p>The cases disagree. Start from one of them, or type the correct details:</p>
              <ul className="grid gap-1">
                {employee.variants.map((variant) => (
                  <li key={variant.caseId} className="flex flex-wrap items-center gap-2">
                    <span>
                      {variant.reference} ({EB_PRODUCT_LABELS[variant.product]}): {variant.name},{' '}
                      {GHI_GENDER_LABELS[variant.gender]},{' '}
                      {variant.dateOfBirth
                        ? formatDate(variant.dateOfBirth)
                        : 'date of birth hidden'}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setName(variant.name);
                        setGender(variant.gender);
                        setDateOfBirth(variant.dateOfBirth ?? '');
                      }}
                    >
                      Use these
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <Field label="Name">
            <Input maxLength={120} value={name} onChange={(event) => setName(event.target.value)} />
            {err('name')}
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Gender">
              <NativeSelect
                value={gender}
                onChange={(event) => setGender(event.target.value as GhiGender | '')}
              >
                <option value="">Choose</option>
                {GHI_GENDERS.map((item) => (
                  <option key={item} value={item}>
                    {GHI_GENDER_LABELS[item]}
                  </option>
                ))}
              </NativeSelect>
              {err('gender')}
            </Field>
            <Field label="Date of birth">
              <Input
                type="date"
                value={dateOfBirth}
                onChange={(event) => setDateOfBirth(event.target.value)}
              />
              {err('dateOfBirth')}
            </Field>
          </div>
          <Field label="Reason for the change">
            <Textarea
              rows={2}
              maxLength={500}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
            {err('reason')}
          </Field>
          {save.isError ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{errorMessage(save.error)}</AlertDescription>
            </Alert>
          ) : null}
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="employee-form" disabled={save.isPending || incomplete}>
            {save.isPending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
            {resolving ? 'Resolve' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
