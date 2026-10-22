'use client';

import { useQuery } from '@tanstack/react-query';
import { Copy, LoaderCircle, Plus } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/ghi/ghi-ui';
import { ErrorState, LoadingState, errorMessage } from '@/components/states';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { toast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api-client';
import {
  claimEmployeesQuery,
  claimLinksQuery,
  claimPoliciesQuery,
  issuesText,
  useClaimMutation,
} from '@/lib/api/claims';
import {
  ClaimLinkSchema,
  ClientListResponseSchema,
  CreateClaimLinkResponseSchema,
  MAX_CLAIM_LINK_DAYS,
  formatDateTime,
  type ClaimLink,
  type ClaimLinkStatus,
} from '@/shared';

const STATUS_VARIANT: Record<ClaimLinkStatus, 'success' | 'muted' | 'warning' | 'destructive'> = {
  ACTIVE: 'success',
  USED: 'muted',
  EXPIRED: 'warning',
  REVOKED: 'destructive',
};
const STATUS_LABEL: Record<ClaimLinkStatus, string> = {
  ACTIVE: 'Active',
  USED: 'Used',
  EXPIRED: 'Expired',
  REVOKED: 'Revoked',
};

/**
 * Employee submission links (C2): each is for one employee of one placed policy, and is shown
 * once. The token sits after "#" in the address, so it is never sent to a server or logged.
 */
export function ClaimLinksView() {
  const links = useQuery(claimLinksQuery());
  const [revoking, setRevoking] = useState<ClaimLink | null>(null);
  const revoke = useClaimMutation(
    (link: ClaimLink) =>
      apiFetch(`claims/links/${link.id}/revoke`, { method: 'POST', schema: ClaimLinkSchema }),
    () => ({ title: 'Link revoked', description: 'It no longer opens.' }),
  );
  return (
    <div className="grid gap-6">
      <NewLink />
      <Card>
        <CardHeader>
          <CardTitle>Links issued</CardTitle>
        </CardHeader>
        <CardContent>
          {links.isPending ? (
            <LoadingState label="Loading links" />
          ) : links.isError ? (
            <ErrorState error={links.error} onRetry={() => void links.refetch()} />
          ) : links.data.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No link issued yet.</p>
          ) : (
            <div
              role="region"
              aria-label="Submission links"
              tabIndex={0}
              className="overflow-x-auto rounded-md border"
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Company and case</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Claims</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Issued</TableHead>
                    <TableHead>
                      <span className="sr-only">Revoke</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {links.data.items.map((link) => (
                    <TableRow key={link.id}>
                      <TableCell>
                        {link.employee.name} ({link.employee.employeeId})
                      </TableCell>
                      <TableCell>
                        {link.clientName}
                        <span className="block text-xs text-muted-foreground">
                          {link.caseReference}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[link.status]}>
                          {STATUS_LABEL[link.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular">
                        {link.usedClaims} of {link.maxClaims}
                      </TableCell>
                      <TableCell className="tabular">{formatDateTime(link.expiresAt)}</TableCell>
                      <TableCell className="tabular">
                        {link.createdBy}, {formatDateTime(link.createdAt)}
                      </TableCell>
                      <TableCell>
                        {link.status === 'ACTIVE' || link.status === 'USED' ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setRevoking(link)}
                          >
                            Revoke
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      <ConfirmDialog
        open={revoking !== null}
        title="Revoke this link?"
        description={
          revoking
            ? `${revoking.employee.name} will no longer be able to submit claims or add documents with it.`
            : ''
        }
        confirmLabel="Revoke"
        pending={revoke.isPending}
        onOpenChange={(open) => {
          if (!open) setRevoking(null);
        }}
        onConfirm={() => {
          if (revoking) revoke.mutate(revoking, { onSettled: () => setRevoking(null) });
        }}
      />
    </div>
  );
}

function NewLink() {
  const [clientId, setClientId] = useState('');
  const [ghiCaseId, setCaseId] = useState('');
  const [text, setText] = useState('');
  const [employeeMemberId, setEmployeeId] = useState('');
  const [expiresInDays, setDays] = useState(7);
  const [maxClaims, setMaxClaims] = useState(1);
  const [url, setUrl] = useState<string | null>(null);
  const q = useDebouncedValue(text, 250);
  const clients = useQuery({
    queryKey: ['clients', 'list', '', 'claims'],
    queryFn: ({ signal }) =>
      apiFetch('clients?limit=100', { schema: ClientListResponseSchema, signal }),
  });
  const policies = useQuery(claimPoliciesQuery(clientId));
  const employees = useQuery(claimEmployeesQuery(ghiCaseId, q));
  const create = useClaimMutation(
    () =>
      apiFetch('claims/links', {
        method: 'POST',
        body: { ghiCaseId, employeeMemberId, expiresInDays, maxClaims },
        schema: CreateClaimLinkResponseSchema,
      }),
    () => ({ title: 'Link created', description: 'Copy it now: it is shown only once.' }),
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>New submission link</CardTitle>
        <CardDescription>
          The employee opens it to submit a claim for themselves or a covered family member, and to
          upload its documents. It cannot see or change anything else.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Label className="grid gap-1 text-sm font-normal">
            Company
            <NativeSelect
              value={clientId}
              onChange={(event) => {
                setClientId(event.target.value);
                setCaseId('');
                setEmployeeId('');
              }}
            >
              <option value="">Choose</option>
              {(clients.data?.items ?? []).map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </NativeSelect>
          </Label>
          <Label className="grid gap-1 text-sm font-normal">
            Policy
            <NativeSelect
              value={ghiCaseId}
              disabled={!clientId}
              onChange={(event) => {
                setCaseId(event.target.value);
                setEmployeeId('');
              }}
            >
              <option value="">Choose</option>
              {(policies.data?.items ?? []).map((item) => (
                <option key={item.ghiCaseId} value={item.ghiCaseId}>
                  {item.policyNumber}
                </option>
              ))}
            </NativeSelect>
          </Label>
          <Label className="grid gap-1 text-sm font-normal">
            Find the employee
            <Input
              type="search"
              disabled={!ghiCaseId}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Name or employee ID"
            />
          </Label>
          <Label className="grid gap-1 text-sm font-normal">
            Employee
            <NativeSelect
              value={employeeMemberId}
              disabled={!ghiCaseId}
              onChange={(event) => setEmployeeId(event.target.value)}
            >
              <option value="">Choose</option>
              {(employees.data?.items ?? []).map((member) => (
                <option key={member.memberId} value={member.memberId}>
                  {member.employeeId} · {member.name}
                </option>
              ))}
            </NativeSelect>
          </Label>
          <Label className="grid gap-1 text-sm font-normal">
            Valid for (days)
            <Input
              type="number"
              min={1}
              max={MAX_CLAIM_LINK_DAYS}
              value={expiresInDays}
              onChange={(event) => setDays(Number(event.target.value))}
            />
          </Label>
          <Label className="grid gap-1 text-sm font-normal">
            Claims it allows
            <Input
              type="number"
              min={1}
              max={10}
              value={maxClaims}
              onChange={(event) => setMaxClaims(Number(event.target.value))}
            />
          </Label>
        </div>
        {create.isError ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>
              {issuesText(create.error) ?? errorMessage(create.error)}
            </AlertDescription>
          </Alert>
        ) : null}
        <div>
          <Button
            type="button"
            disabled={create.isPending || !employeeMemberId}
            onClick={() =>
              create.mutate(undefined, {
                onSuccess: (result) => setUrl(`${window.location.origin}/claim#t=${result.token}`),
              })
            }
          >
            {create.isPending ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : (
              <Plus aria-hidden="true" />
            )}
            Create link
          </Button>
        </div>
        {url ? (
          <Alert variant="success">
            <AlertTitle>Send this link to the employee</AlertTitle>
            <AlertDescription className="grid gap-2">
              <code className="rounded bg-card px-2 py-1 text-xs break-all">{url}</code>
              <span>
                It is shown only once and is not stored; if lost, revoke it and create another.
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="justify-self-start"
                onClick={() => {
                  void navigator.clipboard
                    .writeText(url)
                    .then(() => toast({ title: 'Link copied', variant: 'success' }));
                }}
              >
                <Copy aria-hidden="true" />
                Copy link
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
