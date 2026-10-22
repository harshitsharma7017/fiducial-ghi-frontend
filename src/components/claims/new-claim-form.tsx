'use client';

import { useQuery } from '@tanstack/react-query';
import { LoaderCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { errorMessage } from '@/components/states';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { toast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api-client';
import {
  claimEmployeesQuery,
  claimFamilyQuery,
  claimPoliciesQuery,
  uploadClaimDocument,
  useClaimMutation,
} from '@/lib/api/claims';
import {
  CLAIM_DOCUMENT_KINDS,
  CLAIM_DOCUMENT_KIND_LABELS,
  CLAIM_DOCUMENT_TYPES,
  ClaimDetailSchema,
  ClientListResponseSchema,
  GHI_RELATIONSHIP_LABELS,
  formatDate,
  type ClaimDocumentKind,
} from '@/shared';
import {
  ClaimDetailsFields,
  emptyClaimDetails,
  fieldErrorsOf,
  type ClaimDetailsValues,
} from './claim-fields';

const ACCEPT = [...Object.keys(CLAIM_DOCUMENT_TYPES), ...Object.values(CLAIM_DOCUMENT_TYPES)].join(
  ',',
);

/**
 * Staff create a claim (C2): the company, its placed policy, the employee and the patient from
 * the census (only the employee's covered family is offered), the claim's details and its
 * documents. The API checks every link between them again. The claim starts in Form.
 */
export function NewClaimForm() {
  const router = useRouter();
  const [clientId, setClientId] = useState('');
  const [ghiCaseId, setCaseId] = useState('');
  const [employeeText, setEmployeeText] = useState('');
  const [employeeMemberId, setEmployeeId] = useState('');
  const [patientMemberId, setPatientId] = useState('');
  const [details, setDetails] = useState<ClaimDetailsValues>(emptyClaimDetails());
  const [files, setFiles] = useState<Partial<Record<ClaimDocumentKind, File>>>({});
  const [uploadError, setUploadError] = useState<string | null>(null);
  const q = useDebouncedValue(employeeText, 250);

  const clients = useQuery({
    queryKey: ['clients', 'list', '', 'claims'],
    queryFn: ({ signal }) =>
      apiFetch('clients?limit=100', { schema: ClientListResponseSchema, signal }),
  });
  const policies = useQuery(claimPoliciesQuery(clientId));
  const employees = useQuery(claimEmployeesQuery(ghiCaseId, q));
  const family = useQuery(claimFamilyQuery(ghiCaseId, employeeMemberId));
  const policy = policies.data?.items.find((item) => item.ghiCaseId === ghiCaseId);

  const create = useClaimMutation(
    async () => {
      const claim = await apiFetch('claims', {
        method: 'POST',
        body: { clientId, ghiCaseId, employeeMemberId, patientMemberId, ...details },
        schema: ClaimDetailSchema,
      });
      const failed: string[] = [];
      for (const [kind, file] of Object.entries(files) as [ClaimDocumentKind, File][]) {
        try {
          await uploadClaimDocument(claim.id, kind, file);
        } catch (error) {
          failed.push(`${file.name}: ${errorMessage(error)}`);
        }
      }
      return { claim, failed };
    },
    ({ claim, failed }) => ({
      title: `${claim.claimNumber} created`,
      description:
        failed.length > 0
          ? 'Some documents were not uploaded; add them on the claim.'
          : 'It is in the Form column.',
    }),
  );
  const errors = fieldErrorsOf(create.error);

  return (
    <form
      noValidate
      className="grid max-w-3xl gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        setUploadError(null);
        create.mutate(undefined, {
          onSuccess: ({ claim, failed }) => {
            if (failed.length > 0)
              toast({
                title: 'Documents not uploaded',
                description: failed.join(' '),
                variant: 'destructive',
              });
            router.push(`/claims/${claim.id}`);
          },
        });
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle>Company, policy and patient</CardTitle>
          <CardDescription>
            Only placed group health policies, and only the employee’s covered family, are offered.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Label className="grid gap-1 text-sm font-normal">
            Company
            <NativeSelect
              value={clientId}
              onChange={(event) => {
                setClientId(event.target.value);
                setCaseId('');
                setEmployeeId('');
                setPatientId('');
              }}
            >
              <option value="">Choose the company</option>
              {(clients.data?.items ?? []).map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </NativeSelect>
            {errors.clientId ? (
              <span className="text-xs text-destructive">{errors.clientId}</span>
            ) : null}
          </Label>
          <Label className="grid gap-1 text-sm font-normal">
            Policy
            <NativeSelect
              value={ghiCaseId}
              disabled={!clientId}
              onChange={(event) => {
                setCaseId(event.target.value);
                setEmployeeId('');
                setPatientId('');
              }}
            >
              <option value="">
                {clientId && policies.data?.items.length === 0
                  ? 'No placed policy'
                  : 'Choose the policy'}
              </option>
              {(policies.data?.items ?? []).map((item) => (
                <option key={item.ghiCaseId} value={item.ghiCaseId}>
                  {item.policyNumber} · {item.insurerName}
                </option>
              ))}
            </NativeSelect>
            {policy ? (
              <span className="text-xs text-muted-foreground">
                {formatDate(policy.policyStart)} to {formatDate(policy.policyEnd)} · case{' '}
                {policy.caseReference}
              </span>
            ) : null}
            {errors.ghiCaseId ? (
              <span className="text-xs text-destructive">{errors.ghiCaseId}</span>
            ) : null}
          </Label>
          <Label className="grid gap-1 text-sm font-normal">
            Find the employee
            <Input
              type="search"
              disabled={!ghiCaseId}
              placeholder="Name or employee ID"
              value={employeeText}
              onChange={(event) => setEmployeeText(event.target.value)}
            />
          </Label>
          <Label className="grid gap-1 text-sm font-normal">
            Employee
            <NativeSelect
              value={employeeMemberId}
              disabled={!ghiCaseId}
              onChange={(event) => {
                setEmployeeId(event.target.value);
                setPatientId('');
              }}
            >
              <option value="">Choose the employee</option>
              {(employees.data?.items ?? []).map((member) => (
                <option key={member.memberId} value={member.memberId}>
                  {member.employeeId} · {member.name}
                </option>
              ))}
            </NativeSelect>
            {errors.employeeMemberId ? (
              <span className="text-xs text-destructive">{errors.employeeMemberId}</span>
            ) : null}
          </Label>
          <Label className="grid gap-1 text-sm font-normal sm:col-span-2">
            Patient
            <NativeSelect
              value={patientMemberId}
              disabled={!employeeMemberId}
              onChange={(event) => setPatientId(event.target.value)}
            >
              <option value="">Choose the patient</option>
              {(family.data?.items ?? []).map((member) => (
                <option key={member.memberId} value={member.memberId}>
                  {member.name} ({GHI_RELATIONSHIP_LABELS[member.relationship]}, born{' '}
                  {formatDate(member.dateOfBirth)})
                </option>
              ))}
            </NativeSelect>
            {errors.patientMemberId ? (
              <span className="text-xs text-destructive">{errors.patientMemberId}</span>
            ) : null}
          </Label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hospitalisation and claim</CardTitle>
        </CardHeader>
        <CardContent>
          <ClaimDetailsFields value={details} onChange={setDetails} errors={errors} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Supporting documents</CardTitle>
          <CardDescription>
            PDF, PNG or JPEG, up to 10 MB each. Bills, discharge summary and ID proof are needed
            before the claim is Submitted; you can also add them later.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {CLAIM_DOCUMENT_KINDS.map((kind) => (
            <Label key={kind} className="grid gap-1 text-sm font-normal">
              {CLAIM_DOCUMENT_KIND_LABELS[kind]}
              <Input
                type="file"
                accept={ACCEPT}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file && file.size > 10 * 1024 * 1024) {
                    setUploadError(`${file.name} is larger than 10 MB.`);
                    event.target.value = '';
                    return;
                  }
                  setFiles((current) => ({ ...current, [kind]: file }));
                }}
              />
            </Label>
          ))}
          {uploadError ? (
            <p role="alert" className="text-xs text-destructive sm:col-span-2">
              {uploadError}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {create.isError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{errorMessage(create.error)}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={create.isPending || !patientMemberId}>
          {create.isPending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
          Create claim
        </Button>
        <Button asChild variant="outline">
          <Link href="/claims">Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
