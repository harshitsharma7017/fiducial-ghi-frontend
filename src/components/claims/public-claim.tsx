'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, LoaderCircle, Upload } from 'lucide-react';
import { useRef, useState, useSyncExternalStore } from 'react';
import { ErrorState, LoadingState, errorMessage } from '@/components/states';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { claimLinkFetch } from '@/lib/api/claims';
import {
  CLAIM_DOCUMENT_KINDS,
  CLAIM_DOCUMENT_KIND_LABELS,
  CLAIM_DOCUMENT_TYPES,
  GHI_RELATIONSHIP_LABELS,
  PublicClaimLinkSchema,
  PublicClaimSubmitResponseSchema,
  formatDate,
  formatDateTime,
  type ClaimDocumentKind,
  type PublicClaimLink,
} from '@/shared';
import { z } from 'zod';
import {
  ClaimDetailsFields,
  emptyClaimDetails,
  fieldErrorsOf,
  type ClaimDetailsValues,
} from './claim-fields';

const ACCEPT = [...Object.keys(CLAIM_DOCUMENT_TYPES), ...Object.values(CLAIM_DOCUMENT_TYPES)].join(
  ',',
);

/** The link's token, from the part of the address after "#t=" (never sent to any server). */
function tokenFromHash(): string {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.hash.slice(1)).get('t') ?? '';
}
const subscribe = (listener: () => void) => {
  window.addEventListener('hashchange', listener);
  return () => window.removeEventListener('hashchange', listener);
};

/**
 * The employee's claim submission (C2), opened from the link their HR or broker sent. It shows
 * only their policy and covered family, takes a claim (which lands in the claims team's Form
 * column) and its documents, and nothing else.
 */
export function PublicClaim() {
  const token = useSyncExternalStore(subscribe, tokenFromHash, () => '');
  const link = useQuery({
    queryKey: ['claim-link', token],
    queryFn: () => claimLinkFetch(token, '', { schema: PublicClaimLinkSchema }),
    enabled: token !== '',
    retry: false,
  });
  if (!token) {
    return (
      <Alert variant="destructive" role="alert">
        <AlertTitle>This link is incomplete</AlertTitle>
        <AlertDescription>Open the full link your HR team or broker sent you.</AlertDescription>
      </Alert>
    );
  }
  if (link.isPending) return <LoadingState label="Opening your link" />;
  if (link.isError) return <ErrorState error={link.error} onRetry={() => void link.refetch()} />;
  return <Loaded token={token} link={link.data} />;
}

function Loaded({ token, link }: { token: string; link: PublicClaimLink }) {
  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{link.employee.name}</CardTitle>
          <CardDescription>
            {link.clientName} · group health policy {link.policyNumber} ({link.insurerName}),{' '}
            {formatDate(link.policyStart)} to {formatDate(link.policyEnd)}. This link works until{' '}
            {formatDateTime(link.expiresAt)}.
          </CardDescription>
        </CardHeader>
      </Card>
      {link.claims.map((claim) => (
        <ClaimDocuments key={claim.claimNumber} token={token} claim={claim} />
      ))}
      {link.remainingClaims > 0 ? (
        <SubmitClaim token={token} link={link} />
      ) : (
        <Alert variant="info">
          <AlertTitle>No more claims on this link</AlertTitle>
          <AlertDescription>
            For another claim, ask your HR team or broker for a new link.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function SubmitClaim({ token, link }: { token: string; link: PublicClaimLink }) {
  const queryClient = useQueryClient();
  const [patientMemberId, setPatient] = useState('');
  const [details, setDetails] = useState<ClaimDetailsValues>(emptyClaimDetails());
  const submit = useMutation({
    mutationFn: () =>
      claimLinkFetch(token, '/claims', {
        method: 'POST',
        body: { patientMemberId, ...details },
        schema: PublicClaimSubmitResponseSchema,
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['claim-link', token] }),
  });
  const errors = fieldErrorsOf(submit.error);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Submit a claim</CardTitle>
        <CardDescription>
          For yourself or a family member covered under the policy. You add the documents next.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {submit.isSuccess ? (
          <Alert variant="success" className="mb-4" role="status">
            <CheckCircle2 aria-hidden="true" />
            <AlertTitle>Claim {submit.data.claimNumber} received</AlertTitle>
            <AlertDescription>
              Upload its documents above. The claims team will email you as it moves on.
            </AlertDescription>
          </Alert>
        ) : null}
        <form
          noValidate
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit.mutate(undefined, {
              onSuccess: () => {
                setPatient('');
                setDetails(emptyClaimDetails());
              },
            });
          }}
        >
          <Label className="grid gap-1 text-sm font-normal">
            Patient
            <NativeSelect
              value={patientMemberId}
              onChange={(event) => setPatient(event.target.value)}
            >
              <option value="">Choose who was treated</option>
              {link.members.map((member) => (
                <option key={member.memberId} value={member.memberId}>
                  {member.name} ({GHI_RELATIONSHIP_LABELS[member.relationship]})
                </option>
              ))}
            </NativeSelect>
            {errors.patientMemberId ? (
              <span className="text-xs text-destructive">{errors.patientMemberId}</span>
            ) : null}
          </Label>
          <ClaimDetailsFields value={details} onChange={setDetails} errors={errors} />
          {submit.isError ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{errorMessage(submit.error)}</AlertDescription>
            </Alert>
          ) : null}
          <div>
            <Button type="submit" disabled={submit.isPending || !patientMemberId}>
              {submit.isPending ? (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              ) : null}
              Submit claim
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function ClaimDocuments({
  token,
  claim,
}: {
  token: string;
  claim: PublicClaimLink['claims'][number];
}) {
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<ClaimDocumentKind>(claim.missingDocuments[0] ?? 'OTHER');
  const input = useRef<HTMLInputElement>(null);
  const upload = useMutation({
    mutationFn: (file: File) =>
      claimLinkFetch(
        token,
        `/claims/${claim.claimNumber}/documents?kind=${kind}&fileName=${encodeURIComponent(file.name)}`,
        {
          method: 'POST',
          body: file,
          schema: z.object({ kind: z.string(), fileName: z.string() }),
        },
      ),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['claim-link', token] }),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Claim {claim.claimNumber}</CardTitle>
        <CardDescription>
          For {claim.patientName}.{' '}
          {claim.open
            ? claim.missingDocuments.length > 0
              ? `Still needed: ${claim.missingDocuments.map((item) => CLAIM_DOCUMENT_KIND_LABELS[item]).join(', ')}.`
              : 'All the required documents are in.'
            : 'The claims team is processing it; send any further documents to your HR team or broker.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {claim.documents.length > 0 ? (
          <ul className="grid gap-1 text-sm">
            {claim.documents.map((doc, index) => (
              <li key={index}>
                {CLAIM_DOCUMENT_KIND_LABELS[doc.kind]}: {doc.fileName}
              </li>
            ))}
          </ul>
        ) : null}
        {claim.open ? (
          <div className="flex flex-wrap items-end gap-2">
            <Label className="grid gap-1 text-sm font-normal">
              Document
              <NativeSelect
                className="w-56"
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
              aria-label={`Document for claim ${claim.claimNumber}`}
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
              Upload (PDF, PNG or JPEG, up to 10 MB)
            </Button>
          </div>
        ) : null}
        {upload.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage(upload.error)}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
