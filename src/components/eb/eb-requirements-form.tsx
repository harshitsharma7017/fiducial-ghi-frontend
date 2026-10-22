'use client';

import { CircleAlert, LoaderCircle, Lock, Plus, Save, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Field } from './eb-ui';
import { errorMessage } from '@/components/states';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { ApiError, apiFetch } from '@/lib/api-client';
import { caseApi, useGhiMutation } from '@/lib/api/ghi';
import {
  COVER_CHOICES,
  COVER_CHOICE_LABELS,
  DEPENDANT_BASES,
  DEPENDANT_BASIS_LABELS,
  EbCaseRecordSchema,
  GHI_AGE_GROUPS,
  GHI_AGE_GROUP_LABELS,
  GHI_CLAIM_YEARS,
  GPA_COVERS,
  GPA_COVER_LABELS,
  GpaRequirementsInputSchema,
  GtliRequirementsInputSchema,
  NOMINEE_REQUIREMENTS,
  NOMINEE_REQUIREMENT_LABELS,
  planHasDependants,
  planRelationships,
  type NomineeRequirement,
  type CoverChoice,
  type DependantBasisKind,
  type EbCaseRecord,
  type GpaRequirementsFormValues,
  type GtliRequirementsFormValues,
} from '@/shared';
import { AwaitingNote } from './awaiting-confirmation';
import { RelationshipRulesEditor } from './relationship-rules-editor';
import { SumInsuredBasisFields } from './sum-insured-basis-fields';

// The GPA and GTLI Data Sheets (Requirements 4, 5): checked by the same shared schema the API
// uses, so each problem shows on its field before saving; a refusal by the API shows there too.

type Values = GpaRequirementsFormValues & GtliRequirementsFormValues & Record<string, unknown>;
type Errors = Record<string, string>;

function valuesOf(record: EbCaseRecord): Values {
  const requirements = record.requirements as unknown as Values;
  return {
    ...requirements,
    claims: record.requirements.claims.map(({ claimsRatioPercent: _ratio, ...claim }) => claim),
  };
}

const text = (value: unknown) => (typeof value === 'string' ? value : '');
const numberOrNull = (value: string) => (value.trim() === '' ? null : Number(value));

function errorsOf(
  issues: ReadonlyArray<{ path: PropertyKey[] | string; message: string }>,
): Errors {
  const errors: Errors = {};
  for (const issue of issues) {
    const key = Array.isArray(issue.path) ? issue.path.map(String).join('.') : issue.path;
    errors[key] ??= issue.message;
  }
  return errors;
}

export function EbRequirementsForm({ record }: { record: EbCaseRecord }) {
  const canEdit = usePermission('proposals.edit');
  const locked = record.locked || record.stage === 'CLOSED' || record.placed;
  const disabled = !canEdit || locked;
  const gpa = record.product === 'GPA';
  const [values, setValues] = useState<Values>(() => valuesOf(record));
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [generalError, setGeneralError] = useState<unknown>(null);
  // A save elsewhere (another tab, another user) brings the form up to date unless it is edited.
  const [synced, setSynced] = useState(record.requirementsRevision);
  if (synced !== record.requirementsRevision && !dirty) {
    setSynced(record.requirementsRevision);
    setValues(valuesOf(record));
  }
  const set = (patch: Partial<Values>) => {
    setValues((current) => ({ ...current, ...patch }));
    setDirty(true);
  };
  const save = useGhiMutation(
    record.id,
    (body: unknown) =>
      apiFetch(`${caseApi(record.product, record.id)}/requirements`, {
        method: 'PUT',
        body,
        schema: EbCaseRecordSchema,
      }),
    (saved) => ({
      title: 'Data Sheet saved',
      description:
        saved.missingItems.length > 0
          ? `${saved.missingItems.length} item(s) still needed for the RFQ.`
          : 'Complete: assign the plan and add the census next.',
    }),
  );
  const submit = () => {
    setGeneralError(null);
    const schema = gpa ? GpaRequirementsInputSchema : GtliRequirementsInputSchema;
    const body = gpa
      ? (({ freeCoverLimit: _f, additionalBenefits: _a, ...rest }) => rest)(values)
      : (({ covers: _c, temporaryTotal: _t, otherCovers: _o, dependantBasis: _d, ...rest }) =>
          rest)(values);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      setErrors(errorsOf(parsed.error.issues));
      return;
    }
    setErrors({});
    save.mutate(parsed.data, {
      onSuccess: () => setDirty(false),
      onError: (error) => {
        if (
          error instanceof ApiError &&
          error.code === 'VALIDATION_ERROR' &&
          Array.isArray(error.details)
        ) {
          setErrors(errorsOf(error.details as Array<{ path: string; message: string }>));
        } else setGeneralError(error);
      },
    });
  };
  const err = (path: string) =>
    errors[path] ? <p className="text-xs text-destructive">{errors[path]}</p> : null;
  const dependants = record.plan ? planHasDependants(record.plan.slots) : false;
  const dependantRelationships = record.plan
    ? planRelationships(record.plan.slots).filter((relationship) => relationship !== 'SELF')
    : [];
  const basis = values.sumInsuredBasis;

  return (
    <form
      noValidate
      className="grid gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      {locked ? (
        <Alert variant="info">
          <Lock aria-hidden="true" />
          <AlertTitle>
            {record.stage === 'CLOSED'
              ? 'The case is closed'
              : record.placed
                ? 'The case is placed'
                : 'The Data Sheet is locked'}
          </AlertTitle>
          <AlertDescription>
            {record.stage === 'CLOSED' || record.placed
              ? 'Nothing on it can change.'
              : 'The RFQ has been sent to an insurer, so the Data Sheet stays as sent.'}
          </AlertDescription>
        </Alert>
      ) : record.missingItems.length > 0 ? (
        <Alert variant="warning">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>Needed before the RFQ</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {record.missingItems.map((item) => (
                <li key={item.field}>{item.label}</li>
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
          {(
            [
              ['natureOfBusiness', 'Nature of business'],
              ['locations', 'Locations of the employees'],
              ['contactName', 'HR contact'],
              ['contactEmail', 'HR contact email'],
              ['contactPhone', 'HR contact phone'],
            ] as const
          ).map(([key, label]) => (
            <Field key={key} label={label}>
              <Input
                disabled={disabled}
                value={text(values.company[key])}
                aria-invalid={errors[`company.${key}`] ? true : undefined}
                onChange={(event) =>
                  set({ company: { ...values.company, [key]: event.target.value } })
                }
              />
              {err(`company.${key}`)}
            </Field>
          ))}
          <Field label="Employees to be covered">
            <Input
              inputMode="numeric"
              disabled={disabled}
              value={values.employeeCount?.toString() ?? ''}
              aria-invalid={errors.employeeCount ? true : undefined}
              onChange={(event) => set({ employeeCount: numberOrNull(event.target.value) })}
            />
            {err('employeeCount')}
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sum insured</CardTitle>
          <CardDescription>
            Asked of the insurers for every member; the census follows it.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <SumInsuredBasisFields
            value={basis}
            onChange={(next) => set({ sumInsuredBasis: next })}
            disabled={disabled}
            errors={{
              kind: errors.sumInsuredBasis,
              amount: errors['sumInsuredBasis.amount'],
              amounts: errors['sumInsuredBasis.amounts'],
              multiplier: errors['sumInsuredBasis.multiplier'],
              maximum: errors['sumInsuredBasis.maximum'],
            }}
          />
          {!gpa ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Free cover limit asked for (₹, optional)">
                <Input
                  inputMode="numeric"
                  disabled={disabled}
                  value={text(values.freeCoverLimit)}
                  onChange={(event) => {
                    const amount = event.target.value.replace(/[₹,\s]/g, '');
                    set({ freeCoverLimit: amount === '' ? null : amount });
                  }}
                />
                {err('freeCoverLimit')}
              </Field>
              <AwaitingNote>
                Members above the limit are flagged in the census summary, not refused (open
                question 12).
              </AwaitingNote>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {gpa ? (
        <Card>
          <CardHeader>
            <CardTitle>Covers</CardTitle>
            <CardDescription>
              <AwaitingNote>
                The standard GPA covers and their limits await the client’s confirmation (open
                question 10).
              </AwaitingNote>
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {GPA_COVERS.map((cover) => (
              <Field key={cover} label={GPA_COVER_LABELS[cover]}>
                <NativeSelect
                  disabled={disabled}
                  value={values.covers?.[cover] ?? ''}
                  onChange={(event) =>
                    set({
                      covers: {
                        ...values.covers,
                        [cover]: (event.target.value || null) as CoverChoice | null,
                      },
                      ...(cover === 'temporaryTotal' && event.target.value !== 'REQUIRED'
                        ? { temporaryTotal: { weeklyBenefit: null, weeks: null } }
                        : {}),
                    })
                  }
                >
                  <option value="">Not chosen</option>
                  {COVER_CHOICES.map((choice) => (
                    <option key={choice} value={choice}>
                      {COVER_CHOICE_LABELS[choice]}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            ))}
            {values.covers?.temporaryTotal === 'REQUIRED' ? (
              <>
                <Field label="Weekly benefit (₹, optional)">
                  <Input
                    inputMode="numeric"
                    disabled={disabled}
                    value={text(values.temporaryTotal?.weeklyBenefit)}
                    onChange={(event) => {
                      const amount = event.target.value.replace(/[₹,\s]/g, '');
                      set({
                        temporaryTotal: {
                          ...values.temporaryTotal,
                          weeklyBenefit: amount === '' ? null : amount,
                        },
                      });
                    }}
                  />
                  {err('temporaryTotal.weeklyBenefit')}
                </Field>
                <Field label="Weeks (optional)">
                  <Input
                    inputMode="numeric"
                    disabled={disabled}
                    value={values.temporaryTotal?.weeks?.toString() ?? ''}
                    onChange={(event) =>
                      set({
                        temporaryTotal: {
                          ...values.temporaryTotal,
                          weeks: numberOrNull(event.target.value),
                        },
                      })
                    }
                  />
                  {err('temporaryTotal.weeks')}
                </Field>
              </>
            ) : null}
            <Field label="Other covers and cover limits" className="sm:col-span-2">
              <Textarea
                rows={2}
                disabled={disabled}
                value={text(values.otherCovers)}
                onChange={(event) => set({ otherCovers: event.target.value })}
              />
              {err('otherCovers')}
            </Field>
            {dependants ? (
              <div className="grid gap-2 sm:col-span-2">
                <Field label="Dependants’ sum insured">
                  <NativeSelect
                    disabled={disabled}
                    value={values.dependantBasis?.kind ?? ''}
                    onChange={(event) => {
                      const kind = event.target.value as DependantBasisKind | '';
                      set({
                        dependantBasis:
                          kind === ''
                            ? null
                            : kind === 'PERCENT_OF_EMPLOYEE'
                              ? { kind, percent: '' }
                              : kind === 'BY_RELATIONSHIP'
                                ? { kind, rules: [] }
                                : { kind },
                      });
                    }}
                  >
                    <option value="">Not chosen</option>
                    {DEPENDANT_BASES.map((kind) => (
                      <option key={kind} value={kind}>
                        {DEPENDANT_BASIS_LABELS[kind]}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                {values.dependantBasis?.kind === 'PERCENT_OF_EMPLOYEE' ? (
                  <Field label="Percentage of the employee’s sum insured">
                    <Input
                      inputMode="decimal"
                      disabled={disabled}
                      value={values.dependantBasis.percent}
                      onChange={(event) =>
                        set({
                          dependantBasis: {
                            kind: 'PERCENT_OF_EMPLOYEE',
                            percent: event.target.value.trim(),
                          },
                        })
                      }
                    />
                    {err('dependantBasis.percent')}
                  </Field>
                ) : null}
                {values.dependantBasis?.kind === 'BY_RELATIONSHIP' ? (
                  <RelationshipRulesEditor
                    relationships={dependantRelationships}
                    value={values.dependantBasis.rules}
                    disabled={disabled}
                    errors={errors}
                    onChange={(rules) =>
                      set({
                        dependantBasis: {
                          kind: 'BY_RELATIONSHIP',
                          rules: rules as NonNullable<
                            Extract<Values['dependantBasis'], { kind: 'BY_RELATIONSHIP' }>
                          >['rules'],
                        },
                      })
                    }
                  />
                ) : null}
                <AwaitingNote>
                  How a GPA dependant’s sum insured is set awaits the client’s confirmation (open
                  question 11).
                </AwaitingNote>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Additional benefits</CardTitle>
          </CardHeader>
          <CardContent>
            <Field label="Additional benefits asked for">
              <Textarea
                rows={2}
                disabled={disabled}
                value={text(values.additionalBenefits)}
                onChange={(event) => set({ additionalBenefits: event.target.value })}
              />
              {err('additionalBenefits')}
            </Field>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Nominees</CardTitle>
          <CardDescription>
            Who must name a nominee in the census (name, relationship to the insured, date of birth
            or age). One nominee per member.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          <Field label="Nominee required">
            <NativeSelect
              disabled={disabled}
              value={values.nominees ?? 'NOT_REQUIRED'}
              onChange={(event) => set({ nominees: event.target.value as NomineeRequirement })}
            >
              {NOMINEE_REQUIREMENTS.map((requirement) => (
                <option key={requirement} value={requirement}>
                  {NOMINEE_REQUIREMENT_LABELS[requirement]}
                </option>
              ))}
            </NativeSelect>
            {err('nominees')}
          </Field>
          <AwaitingNote>
            Which members need a nominee awaits the client’s confirmation (open question NM-1); a
            new case asks for it on each employee’s row.
          </AwaitingNote>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ages</CardTitle>
          <CardDescription>
            In completed years on the age reference date; blank is no limit (set per case, open
            question 13).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div
            role="region"
            aria-label="Age limits"
            tabIndex={0}
            className="overflow-x-auto rounded-md border"
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Members</TableHead>
                  <TableHead>Minimum age</TableHead>
                  <TableHead>Maximum age</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {GHI_AGE_GROUPS.map((group) => (
                  <TableRow key={group}>
                    <TableCell>{GHI_AGE_GROUP_LABELS[group]}</TableCell>
                    {(['min', 'max'] as const).map((bound) => (
                      <TableCell key={bound}>
                        <Input
                          inputMode="numeric"
                          className="max-w-28"
                          aria-label={`${GHI_AGE_GROUP_LABELS[group]}, ${bound === 'min' ? 'minimum' : 'maximum'} age`}
                          placeholder="No limit"
                          disabled={disabled}
                          value={values.ageLimits[group][bound]?.toString() ?? ''}
                          onChange={(event) =>
                            set({
                              ageLimits: {
                                ...values.ageLimits,
                                [group]: {
                                  ...values.ageLimits[group],
                                  [bound]: numberOrNull(event.target.value),
                                },
                              },
                            })
                          }
                        />
                        {err(`ageLimits.${group}.${bound}`)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Field label="Age reference date (blank: the policy start)">
            <Input
              type="date"
              className="max-w-48"
              disabled={disabled}
              value={text(values.ageReferenceDate)}
              onChange={(event) => set({ ageReferenceDate: event.target.value })}
            />
            {err('ageReferenceDate')}
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Previous years’ premium and claims</CardTitle>
          <CardDescription>Up to {GHI_CLAIM_YEARS} policy years, each once.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {values.claims.map((claim, index) => (
            <div key={index} className="grid gap-2 rounded-md border p-3 sm:grid-cols-4">
              {(
                [
                  ['policyYear', 'Policy year (2025-26)'],
                  ['insurer', 'Insurer'],
                  ['premium', 'Premium (₹)'],
                  ['claimsPaid', 'Claims paid (₹)'],
                  ['claimsOutstanding', 'Outstanding (₹)'],
                ] as const
              ).map(([key, label]) => (
                <Field key={key} label={label}>
                  <Input
                    disabled={disabled}
                    value={text(claim[key])}
                    onChange={(event) => {
                      const claims = [...values.claims];
                      claims[index] = { ...claim, [key]: event.target.value };
                      set({ claims });
                    }}
                  />
                  {err(`claims.${index}.${key}`)}
                </Field>
              ))}
              {(
                [
                  ['livesCovered', 'Lives'],
                  ['claimCount', 'Claims'],
                ] as const
              ).map(([key, label]) => (
                <Field key={key} label={label}>
                  <Input
                    inputMode="numeric"
                    disabled={disabled}
                    value={claim[key]?.toString() ?? ''}
                    onChange={(event) => {
                      const claims = [...values.claims];
                      claims[index] = { ...claim, [key]: numberOrNull(event.target.value) };
                      set({ claims });
                    }}
                  />
                </Field>
              ))}
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={disabled}
                  onClick={() =>
                    set({ claims: values.claims.filter((_, other) => other !== index) })
                  }
                >
                  <Trash2 aria-hidden="true" />
                  Remove year
                </Button>
              </div>
            </div>
          ))}
          {err('claims')}
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || values.claims.length >= GHI_CLAIM_YEARS}
              onClick={() =>
                set({
                  claims: [
                    ...values.claims,
                    {
                      policyYear: '',
                      insurer: '',
                      livesCovered: null,
                      premium: '',
                      claimsPaid: '',
                      claimsOutstanding: '',
                      claimCount: null,
                    },
                  ],
                })
              }
            >
              <Plus aria-hidden="true" />
              Add a year
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Other requirements</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            rows={3}
            aria-label="Other requirements"
            disabled={disabled}
            value={text(values.otherRequirements)}
            onChange={(event) => set({ otherRequirements: event.target.value })}
          />
          {err('otherRequirements')}
        </CardContent>
      </Card>

      {Object.keys(errors).length > 0 ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>Correct the fields marked above, then save again.</AlertDescription>
        </Alert>
      ) : null}
      {generalError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{errorMessage(generalError)}</AlertDescription>
        </Alert>
      ) : null}
      {disabled ? null : (
        <div>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : (
              <Save aria-hidden="true" />
            )}
            Save Data Sheet
          </Button>
        </div>
      )}
    </form>
  );
}
