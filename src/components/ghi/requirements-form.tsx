'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CircleAlert, LoaderCircle, Lock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { errorMessage } from '@/components/states';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { usePermission } from '@/hooks/use-permission';
import { apiFetch } from '@/lib/api-client';
import { issuesText, useGhiMutation } from '@/lib/api/ghi';
import { applyServerFieldErrors } from '@/lib/form-errors';
import {
  GHI_COVERAGE_TYPES,
  GHI_COVERAGE_TYPE_LABELS,
  GHI_MAX_CHILDREN,
  GHI_PARENT_COVERS,
  GHI_PARENT_COVER_LABELS,
  GHI_ROOM_RENT_KINDS,
  GHI_ROOM_RENT_KIND_LABELS,
  GHI_WAIVERS,
  GHI_WAIVER_LABELS,
  GhiCaseRecordSchema,
  GhiRequirementsInputSchema,
  type GhiCaseRecord,
  type GhiRequirementsFormValues,
  type GhiRequirementsInput,
} from '@/shared';
import { Field } from './case-actions';
import { YesNo } from './ghi-ui';
import {
  AgeLimits,
  ClaimsTable,
  SumInsuredOptions,
  numberValue,
  type RequirementsForm as RequirementsFormApi,
} from './requirements-parts';

/** The saved Data Sheet as form values (the claims ratio is the API's, not an input). */
function valuesOf(record: GhiCaseRecord): GhiRequirementsFormValues {
  const { claims, ...rest } = record.requirements;
  return { ...rest, claims: claims.map(({ claimsRatioPercent: _ratio, ...claim }) => claim) };
}

/**
 * The GHI Data Sheet (G2): company details, who the family covers, sums insured, maternity,
 * pre-existing diseases, waivers, room rent, parents' co-payment, corporate buffer, three years of
 * claims and the census age limits. Locked once the RFQ has gone to an insurer.
 */
export function RequirementsForm({ record }: { record: GhiCaseRecord }) {
  const canEdit = usePermission('proposals.edit');
  const locked = record.locked || record.stage === 'CLOSED';
  const disabled = !canEdit || locked;
  const form = useForm<GhiRequirementsFormValues, unknown, GhiRequirementsInput>({
    resolver: zodResolver(GhiRequirementsInputSchema),
    defaultValues: valuesOf(record),
  });
  const [generalError, setGeneralError] = useState<unknown>(null);
  // A save elsewhere (another tab, another user) brings the form up to date unless it is being edited.
  useEffect(() => {
    if (!form.formState.isDirty) form.reset(valuesOf(record));
  }, [record, form]);
  const save = useGhiMutation(
    record.id,
    (body: GhiRequirementsInput) =>
      apiFetch(`ghi/cases/${record.id}/requirements`, {
        method: 'PUT',
        body,
        schema: GhiCaseRecordSchema,
      }),
    (saved) => ({
      title: 'Data Sheet saved',
      description:
        saved.missing.length > 0
          ? `${saved.missing.length} item(s) still needed for the RFQ.`
          : 'Complete: the census and RFQ come next.',
    }),
  );
  const [parents, maternity, roomRentKind] = [
    useWatch({ control: form.control, name: 'familyDefinition.parents' }),
    useWatch({ control: form.control, name: 'maternity.covered' }),
    useWatch({ control: form.control, name: 'roomRent.kind' }),
  ];
  const errors = form.formState.errors;
  const text = (
    name: Parameters<typeof form.register>[0],
    label: string,
    props: React.ComponentProps<typeof Input> = {},
  ) => (
    <Field label={label}>
      <Input
        disabled={disabled}
        {...props}
        {...form.register(name, { setValueAs: (value: unknown) => value ?? '' })}
      />
    </Field>
  );

  return (
    <form
      noValidate
      className="grid gap-6"
      onSubmit={(event) =>
        void form.handleSubmit((values) => {
          setGeneralError(null);
          save.mutate(values, {
            onSuccess: (saved) => form.reset(valuesOf(saved)),
            onError: (error) => {
              if (!applyServerFieldErrors(error, form.setError)) setGeneralError(error);
            },
          });
        })(event)
      }
    >
      {locked ? (
        <Alert variant="info">
          <Lock aria-hidden="true" />
          <AlertTitle>
            {record.stage === 'CLOSED' ? 'The case is closed' : 'The Data Sheet is locked'}
          </AlertTitle>
          <AlertDescription>
            {record.stage === 'CLOSED'
              ? 'Nothing on it can change.'
              : 'The RFQ has gone to an insurer, so the Data Sheet stays as sent. Changes after this are endorsements (not handled in the app yet).'}
          </AlertDescription>
        </Alert>
      ) : record.missing.length > 0 ? (
        <Alert variant="warning">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>Needed before the RFQ</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {record.missing.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Company</CardTitle>
          <CardDescription>
            {record.client.name} · {record.client.address}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {text('company.natureOfBusiness', 'Nature of business', {
            placeholder: record.client.natureOfBusiness,
          })}
          {text('company.locations', 'Locations of the employees')}
          {text('company.contactName', 'HR contact')}
          {text('company.contactEmail', 'HR contact email', { type: 'email' })}
          {text('company.contactPhone', 'HR contact phone', { type: 'tel' })}
          <Field label="Employees to be covered">
            <Input
              inputMode="numeric"
              disabled={disabled}
              value={useWatch({ control: form.control, name: 'employeeCount' })?.toString() ?? ''}
              onChange={(event) =>
                form.setValue('employeeCount', numberValue(event.target.value), {
                  shouldDirty: true,
                })
              }
              aria-invalid={errors.employeeCount ? true : undefined}
            />
          </Field>
          {errors.company || errors.employeeCount ? (
            <p className="text-xs text-destructive sm:col-span-2">
              {[
                errors.company?.contactEmail?.message,
                errors.company?.contactPhone?.message,
                errors.employeeCount?.message,
              ]
                .filter(Boolean)
                .join(' ')}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Family definition and sum insured</CardTitle>
          <CardDescription>
            {record.plan
              ? `The family definition is taken from the plan ${record.plan.name} v${record.plan.versionNumber} (Plan and census tab); the family fields here do not apply while it is assigned.`
              : 'Self, spouse, up to three children, and either parents or parents-in-law.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Label className="flex items-center gap-2 text-sm font-normal">
            <Checkbox
              disabled={disabled}
              checked={useWatch({ control: form.control, name: 'familyDefinition.spouse' })}
              onCheckedChange={(checked) =>
                form.setValue('familyDefinition.spouse', checked === true, { shouldDirty: true })
              }
            />
            Spouse covered
          </Label>
          <Field label="Children covered, at most">
            <NativeSelect
              disabled={disabled}
              {...form.register('familyDefinition.maxChildren', { valueAsNumber: true })}
            >
              {Array.from({ length: GHI_MAX_CHILDREN + 1 }, (_, count) => (
                <option key={count} value={count}>
                  {count === 0 ? 'No children' : count}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Parents">
            <NativeSelect disabled={disabled} {...form.register('familyDefinition.parents')}>
              {GHI_PARENT_COVERS.map((value) => (
                <option key={value} value={value}>
                  {GHI_PARENT_COVER_LABELS[value]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Coverage">
            <NativeSelect
              disabled={disabled}
              value={useWatch({ control: form.control, name: 'coverageType' }) ?? ''}
              onChange={(event) =>
                form.setValue(
                  'coverageType',
                  (event.target.value || null) as GhiRequirementsInput['coverageType'],
                  { shouldDirty: true },
                )
              }
            >
              <option value="">Not chosen</option>
              {GHI_COVERAGE_TYPES.map((value) => (
                <option key={value} value={value}>
                  {GHI_COVERAGE_TYPE_LABELS[value]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <div className="sm:col-span-2">
            <SumInsuredOptions
              disabled={disabled}
              value={useWatch({ control: form.control, name: 'sumInsuredOptions' }) ?? []}
              onChange={(value) =>
                form.setValue('sumInsuredOptions', value, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
              error={errors.sumInsuredOptions?.message ?? errors.sumInsuredOptions?.[0]?.message}
            />
          </div>
          <Field
            label="Co-payment for parents (%)"
            hint={parents === 'NONE' ? 'Parents are not covered.' : undefined}
          >
            <Input
              inputMode="decimal"
              disabled={disabled || parents === 'NONE'}
              {...form.register('parentsCoPayPercent', {
                setValueAs: (value: unknown) => value ?? '',
              })}
            />
          </Field>
          {errors.parentsCoPayPercent ? (
            <p className="text-xs text-destructive">{errors.parentsCoPayPercent.message}</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Benefits and waivers</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <YesNo
            label="Maternity covered"
            disabled={disabled}
            value={maternity ?? null}
            onChange={(value) => form.setValue('maternity.covered', value, { shouldDirty: true })}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {text('maternity.normalLimit', 'Normal delivery limit (₹)', {
              inputMode: 'numeric',
              disabled: disabled || maternity !== true,
            })}
            {text('maternity.cesareanLimit', 'Caesarean limit (₹)', {
              inputMode: 'numeric',
              disabled: disabled || maternity !== true,
            })}
          </div>
          <YesNo
            label="New-born baby covered from day 1"
            disabled={disabled}
            value={useWatch({ control: form.control, name: 'maternity.newbornCovered' }) ?? null}
            onChange={(value) =>
              form.setValue('maternity.newbornCovered', value, { shouldDirty: true })
            }
          />
          <YesNo
            label="9-month maternity waiting period waived"
            disabled={disabled}
            value={useWatch({ control: form.control, name: 'maternity.nineMonthWaiver' }) ?? null}
            onChange={(value) =>
              form.setValue('maternity.nineMonthWaiver', value, { shouldDirty: true })
            }
          />
          <YesNo
            label="Pre-existing diseases covered"
            disabled={disabled}
            value={useWatch({ control: form.control, name: 'preExistingDiseases.covered' }) ?? null}
            onChange={(value) =>
              form.setValue('preExistingDiseases.covered', value, { shouldDirty: true })
            }
          />
          {text('preExistingDiseases.note', 'Pre-existing diseases: note')}
          {GHI_WAIVERS.map((waiver) => (
            <WaiverField key={waiver} form={form} waiver={waiver} disabled={disabled} />
          ))}
          {errors.maternity ? (
            <p className="text-xs text-destructive sm:col-span-2">
              {[errors.maternity.normalLimit?.message, errors.maternity.cesareanLimit?.message]
                .filter(Boolean)
                .join(' ')}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Room rent and corporate buffer</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label="Room rent">
            <NativeSelect
              disabled={disabled}
              value={roomRentKind ?? ''}
              onChange={(event) =>
                form.setValue(
                  'roomRent.kind',
                  (event.target.value || null) as GhiRequirementsInput['roomRent']['kind'],
                  { shouldDirty: true },
                )
              }
            >
              <option value="">Not stated</option>
              {GHI_ROOM_RENT_KINDS.map((value) => (
                <option key={value} value={value}>
                  {GHI_ROOM_RENT_KIND_LABELS[value]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          {text(
            'roomRent.normal',
            roomRentKind === 'FIXED_AMOUNT' ? 'Normal room (₹/day)' : 'Normal room (% of SI)',
            {
              inputMode: 'decimal',
              disabled: disabled || !roomRentKind || roomRentKind === 'NO_LIMIT',
            },
          )}
          {text('roomRent.icu', roomRentKind === 'FIXED_AMOUNT' ? 'ICU (₹/day)' : 'ICU (% of SI)', {
            inputMode: 'decimal',
            disabled: disabled || !roomRentKind || roomRentKind === 'NO_LIMIT',
          })}
          {text('corporateBuffer.amount', 'Corporate buffer (₹)', { inputMode: 'numeric' })}
          {text('corporateBuffer.perFamilyLimit', 'Buffer limit per family (₹)', {
            inputMode: 'numeric',
          })}
          {text('corporateBuffer.note', 'Buffer: conditions')}
          {errors.roomRent || errors.corporateBuffer ? (
            <p className="text-xs text-destructive sm:col-span-3">
              {[
                errors.roomRent?.normal?.message,
                errors.roomRent?.icu?.message,
                errors.corporateBuffer?.amount?.message,
                errors.corporateBuffer?.perFamilyLimit?.message,
              ]
                .filter(Boolean)
                .join(' ')}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Previous three years: premium and claims</CardTitle>
          <CardDescription>
            {record.type === 'RENEWAL'
              ? 'A renewal needs at least the last year.'
              : 'If the group had a policy before.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ClaimsTable form={form} disabled={disabled} saved={record.requirements.claims} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Census age limits</CardTitle>
          <CardDescription>
            Ages are completed years on the age reference date. Blank is no limit. The client has
            not confirmed eligibility limits yet; set them per case.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Field
            label="Age reference date"
            hint="Blank: the policy start, else the day the case was created."
          >
            <Input
              type="date"
              className="max-w-48"
              disabled={disabled}
              {...form.register('ageReferenceDate', {
                setValueAs: (value: unknown) => value ?? '',
              })}
            />
          </Field>
          <AgeLimits form={form} disabled={disabled} />
          <Field label="Other requirements">
            <Textarea
              rows={3}
              maxLength={2000}
              disabled={disabled}
              {...form.register('otherRequirements', {
                setValueAs: (value: unknown) => value ?? '',
              })}
            />
          </Field>
        </CardContent>
      </Card>

      {generalError || save.isError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>
            {issuesText(save.error) ?? errorMessage(generalError ?? save.error)}
          </AlertDescription>
        </Alert>
      ) : null}
      {canEdit && !locked ? (
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!form.formState.isDirty}
            onClick={() => form.reset(valuesOf(record))}
          >
            Discard changes
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
            Save Data Sheet
          </Button>
        </div>
      ) : null}
    </form>
  );
}

function WaiverField({
  form,
  waiver,
  disabled,
}: {
  form: RequirementsFormApi;
  waiver: (typeof GHI_WAIVERS)[number];
  disabled: boolean;
}) {
  const value = useWatch({ control: form.control, name: `waivers.${waiver}` });
  return (
    <YesNo
      label={GHI_WAIVER_LABELS[waiver]}
      disabled={disabled}
      value={value ?? null}
      onChange={(next) => form.setValue(`waivers.${waiver}`, next, { shouldDirty: true })}
    />
  );
}
