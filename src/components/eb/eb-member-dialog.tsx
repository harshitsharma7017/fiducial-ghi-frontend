'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LoaderCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
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
import { ApiError, apiFetch } from '@/lib/api-client';
import { caseApi, refreshGhiCase } from '@/lib/api/ghi';
import { censusMemberOf, clientCensusContext } from '@/lib/eb/census-context';
import {
  EbMemberInputSchema,
  EbMemberSchema,
  GHI_GENDERS,
  GHI_GENDER_LABELS,
  GHI_RELATIONSHIP_LABELS,
  candidateFromMember,
  checkEbCensus,
  ebMemberFromInput,
  nomineeRequiredFor,
  nomineeRequirementOf,
  planRelationships,
  salaryInputOf,
  NOMINEE_RELATIONSHIPS,
  NOMINEE_RELATIONSHIP_LABELS,
  type NomineeRelationship,
  type EbCaseRecord,
  type EbMember,
  type EbMemberFormValues,
} from '@/shared';
import { Field } from './eb-ui';

type Errors = Record<string, string>;

/**
 * Adds or edits one census member (Requirement 23): the same Census_Validator as the import runs
 * while typing (23.3), and the API checks again against the census as stored, with the
 * company's employee identities (23.2); its messages land on the fields, and the input stays.
 */
export function EbMemberDialog({
  record,
  member,
  census,
  onClose,
}: {
  record: EbCaseRecord;
  member: EbMember | null;
  /** The census as listed, for feedback while typing. */
  census: readonly EbMember[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const accepted = record.plan ? planRelationships(record.plan.slots) : ['SELF' as const];
  const [values, setValues] = useState<EbMemberFormValues>(() =>
    member
      ? {
          employeeId: member.employeeId,
          name: member.name,
          gender: member.gender,
          dateOfBirth: member.dateOfBirth ?? '',
          relationship: member.relationship,
          dateOfJoining: member.dateOfJoining ?? '',
          sumInsured: member.sumInsured ?? '',
          annualSalary: member.annualSalary ?? '',
          monthlySalary: member.monthlySalary ?? '',
          nominee: member.nominee,
        }
      : {
          employeeId: '',
          name: '',
          gender: 'MALE',
          dateOfBirth: '',
          relationship: 'SELF',
          dateOfJoining: '',
          sumInsured: '',
          annualSalary: '',
          monthlySalary: '',
          nominee: null,
        },
  );
  const [serverErrors, setServerErrors] = useState<Errors>({});
  const set = (patch: Partial<EbMemberFormValues>) => {
    setValues((current) => ({ ...current, ...patch }));
    setServerErrors({});
  };
  // The checks while typing: the form, then the Census_Validator against the listed census.
  const typed = useMemo(() => {
    const parsed = EbMemberInputSchema.safeParse(values);
    if (!parsed.success) {
      const errors: Errors = {};
      for (const issue of parsed.error.issues) errors[issue.path.join('.')] ??= issue.message;
      return { errors, ready: false };
    }
    const context = clientCensusContext(record);
    if (!context) return { errors: {}, ready: true };
    const others = census.filter((item) => item.id !== member?.id).map(censusMemberOf);
    const issues =
      checkEbCensus(
        [candidateFromMember('typed', ebMemberFromInput(parsed.data))],
        others,
        context,
      ).get('typed') ?? [];
    const errors: Errors = {};
    for (const issue of issues) {
      if (issue.severity === 'ERROR')
        errors[issue.field ?? 'form'] ??= `${issue.message} ${issue.fix}`;
    }
    return { errors, ready: true };
  }, [values, record, census, member]);
  const errors = { ...typed.errors, ...serverErrors };
  const save = useMutation({
    mutationFn: () =>
      apiFetch(
        member
          ? `${caseApi(record.product, record.id)}/members/${member.id}`
          : `${caseApi(record.product, record.id)}/members`,
        { method: member ? 'PUT' : 'POST', body: values, schema: EbMemberSchema },
      ),
    onSuccess: () => {
      refreshGhiCase(queryClient, record.id);
      onClose();
    },
    onError: (error) => {
      if (
        error instanceof ApiError &&
        error.code === 'VALIDATION_ERROR' &&
        Array.isArray(error.details)
      ) {
        const next: Errors = {};
        for (const item of error.details as Array<{
          path: string;
          message: string;
          fix?: string;
        }>) {
          next[item.path || 'form'] ??= `${item.message}${item.fix ? ` ${item.fix}` : ''}`;
        }
        setServerErrors(next);
      }
    },
  });
  const basis = record.requirements.sumInsuredBasis;
  const salaryBasis = basis?.kind === 'SALARY_MULTIPLE';
  const monthlyBasis = basis?.kind === 'SALARY_MULTIPLE' && salaryInputOf(basis) === 'MONTHLY';
  const nomineeRule = nomineeRequirementOf(record.requirements);
  const nomineeNeeded = nomineeRequiredFor(nomineeRule, values.relationship ?? 'SELF');
  const nominee = values.nominee ?? null;
  const setNominee = (patch: Partial<NonNullable<EbMemberFormValues['nominee']>> | null) =>
    set({
      nominee:
        patch === null
          ? null
          : {
              name: '',
              relationship: 'SPOUSE',
              dateOfBirth: null,
              age: null,
              ...(nominee ?? {}),
              ...patch,
            },
    });
  const err = (key: string) =>
    errors[key] ? <span className="text-xs text-destructive">{errors[key]}</span> : null;
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{member ? 'Edit member' : 'Add member'}</DialogTitle>
          <DialogDescription>
            Checked against the plan{' '}
            {record.plan ? `${record.plan.name} v${record.plan.versionNumber}` : ''}, the Data Sheet
            and the census, as the import is.
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <Field label="Employee ID">
            <Input
              value={values.employeeId}
              aria-invalid={errors.employeeId ? true : undefined}
              onChange={(event) => set({ employeeId: event.target.value })}
            />
            {err('employeeId')}
          </Field>
          <Field label="Name">
            <Input
              value={values.name}
              aria-invalid={errors.name ? true : undefined}
              onChange={(event) => set({ name: event.target.value })}
            />
            {err('name')}
          </Field>
          <Field label="Gender">
            <NativeSelect
              value={values.gender}
              onChange={(event) =>
                set({ gender: event.target.value as EbMemberFormValues['gender'] })
              }
            >
              {GHI_GENDERS.map((gender) => (
                <option key={gender} value={gender}>
                  {GHI_GENDER_LABELS[gender]}
                </option>
              ))}
            </NativeSelect>
            {err('gender')}
          </Field>
          <Field label="Relationship">
            <NativeSelect
              value={values.relationship}
              onChange={(event) =>
                set({ relationship: event.target.value as EbMemberFormValues['relationship'] })
              }
            >
              {accepted.map((relationship) => (
                <option key={relationship} value={relationship}>
                  {GHI_RELATIONSHIP_LABELS[relationship]}
                </option>
              ))}
            </NativeSelect>
            {err('relationship')}
          </Field>
          <Field label="Date of birth">
            <Input
              type="date"
              value={values.dateOfBirth}
              aria-invalid={errors.dateOfBirth ? true : undefined}
              onChange={(event) => set({ dateOfBirth: event.target.value })}
            />
            {err('dateOfBirth')}
          </Field>
          <Field label="Date of joining (optional)">
            <Input
              type="date"
              value={values.dateOfJoining ?? ''}
              onChange={(event) => set({ dateOfJoining: event.target.value })}
            />
            {err('dateOfJoining')}
          </Field>
          <Field label="Sum insured (₹)">
            <Input
              inputMode="numeric"
              value={values.sumInsured ?? ''}
              onChange={(event) => set({ sumInsured: event.target.value.replace(/[₹,\s]/g, '') })}
            />
            {err('sumInsured')}
          </Field>
          {monthlyBasis ? (
            <Field label="Monthly salary (₹)" hint="Annual CTC = monthly × 12">
              <Input
                inputMode="numeric"
                value={values.monthlySalary ?? ''}
                aria-invalid={errors.monthlySalary ? true : undefined}
                onChange={(event) =>
                  set({ monthlySalary: event.target.value.replace(/[₹,\s]/g, '') })
                }
              />
              {err('monthlySalary')}
            </Field>
          ) : null}
          {salaryBasis && !monthlyBasis ? (
            <Field label="Annual salary (₹)">
              <Input
                inputMode="numeric"
                value={values.annualSalary ?? ''}
                onChange={(event) =>
                  set({ annualSalary: event.target.value.replace(/[₹,\s]/g, '') })
                }
              />
              {err('annualSalary')}
            </Field>
          ) : null}
          <fieldset className="grid gap-3 rounded-md border p-3 sm:col-span-2 sm:grid-cols-2">
            <legend className="px-1 text-sm">
              Nominee {nomineeNeeded ? '(required)' : '(optional)'}
            </legend>
            {nominee === null ? (
              <div className="sm:col-span-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setNominee({})}>
                  Add the nominee
                </Button>
                {err('nomineeName')}
              </div>
            ) : (
              <>
                <Field label="Nominee’s name">
                  <Input
                    value={nominee.name}
                    aria-invalid={errors['nominee.name'] || errors.nomineeName ? true : undefined}
                    onChange={(event) => setNominee({ name: event.target.value })}
                  />
                  {err('nominee.name')}
                  {err('nomineeName')}
                </Field>
                <Field label="Relationship to the insured">
                  <NativeSelect
                    value={nominee.relationship}
                    onChange={(event) =>
                      setNominee({ relationship: event.target.value as NomineeRelationship })
                    }
                  >
                    {NOMINEE_RELATIONSHIPS.map((relationship) => (
                      <option key={relationship} value={relationship}>
                        {NOMINEE_RELATIONSHIP_LABELS[relationship]}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="Date of birth" hint="Or give the age">
                  <Input
                    type="date"
                    value={nominee.dateOfBirth ?? ''}
                    onChange={(event) => setNominee({ dateOfBirth: event.target.value || null })}
                  />
                  {err('nominee.dateOfBirth')}
                </Field>
                <Field label="Age (years)">
                  <Input
                    inputMode="numeric"
                    value={nominee.age?.toString() ?? ''}
                    onChange={(event) =>
                      setNominee({
                        age: event.target.value.trim() === '' ? null : Number(event.target.value),
                      })
                    }
                  />
                  {err('nominee.age')}
                </Field>
                {nomineeNeeded ? null : (
                  <div className="sm:col-span-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setNominee(null)}
                    >
                      Remove the nominee
                    </Button>
                  </div>
                )}
              </>
            )}
          </fieldset>
          {errors.form ? (
            <p className="text-xs text-destructive sm:col-span-2">{errors.form}</p>
          ) : null}
          {save.isError && Object.keys(serverErrors).length === 0 ? (
            <Alert variant="destructive" role="alert" className="sm:col-span-2">
              <AlertDescription>{errorMessage(save.error)}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={save.isPending || !typed.ready || Object.keys(typed.errors).length > 0}
            >
              {save.isPending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
              {member ? 'Save member' : 'Add member'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
