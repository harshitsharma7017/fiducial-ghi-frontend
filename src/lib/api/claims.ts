import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import type { z } from 'zod';
import { toast } from '@/hooks/use-toast';
import { ApiError, apiFetch } from '@/lib/api-client';
import {
  ApiErrorSchema,
  ClaimBoardSchema,
  ClaimDetailSchema,
  ClaimDocumentSchema,
  ClaimEmailTemplateListResponseSchema,
  ClaimHrContactSchema,
  ClaimLinkListResponseSchema,
  ClaimListResponseSchema,
  ClaimMemberListResponseSchema,
  ClaimPolicyListResponseSchema,
  type ClaimDocumentKind,
  type ClaimStatus,
} from '@/shared';

// Group health claims data, from /api/v1/claims through the proxy. Everything sits under
// ['claims'], so one invalidation refreshes the board, the table and the open claim.

export const claimKeys = {
  all: ['claims'] as const,
  board: (filters: unknown) => ['claims', 'board', filters] as const,
  list: (filters: unknown) => ['claims', 'list', filters] as const,
  detail: (id: string) => ['claims', 'detail', id] as const,
};

export interface ClaimFilters {
  q: string;
  clientId: string;
  status: ClaimStatus | '';
  dateField: 'CREATED' | 'ADMISSION';
  from: string;
  to: string;
  page: number;
}

function paramsOf(filters: Partial<ClaimFilters>, extra: Record<string, string> = {}) {
  const params = new URLSearchParams(extra);
  if (filters.q?.trim()) params.set('q', filters.q.trim());
  if (filters.clientId) params.set('clientId', filters.clientId);
  if (filters.status) params.set('status', filters.status);
  if (filters.from || filters.to) params.set('dateField', filters.dateField ?? 'CREATED');
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  return params.toString();
}

export function claimBoardQuery(filters: Pick<ClaimFilters, 'q' | 'clientId'>) {
  return queryOptions({
    queryKey: claimKeys.board(filters),
    queryFn: ({ signal }) =>
      apiFetch(`claims/board?${paramsOf(filters)}`, { schema: ClaimBoardSchema, signal }),
  });
}

export function claimListQuery(filters: ClaimFilters) {
  return queryOptions({
    queryKey: claimKeys.list(filters),
    queryFn: ({ signal }) =>
      apiFetch(`claims?${paramsOf(filters, { page: String(filters.page), limit: '20' })}`, {
        schema: ClaimListResponseSchema,
        signal,
      }),
  });
}

export function claimQuery(id: string) {
  return queryOptions({
    queryKey: claimKeys.detail(id),
    queryFn: ({ signal }) => apiFetch(`claims/${id}`, { schema: ClaimDetailSchema, signal }),
  });
}

const simple = <T>(key: readonly unknown[], path: string, schema: z.ZodType<T>, enabled = true) =>
  queryOptions({
    queryKey: ['claims', ...key],
    queryFn: ({ signal }) => apiFetch(path, { schema, signal }),
    enabled,
  });

export const claimPoliciesQuery = (clientId: string) =>
  simple(
    ['policies', clientId],
    `claims/policies${clientId ? `?clientId=${clientId}` : ''}`,
    ClaimPolicyListResponseSchema,
    Boolean(clientId),
  );
export const claimEmployeesQuery = (caseId: string, q: string) =>
  simple(
    ['employees', caseId, q],
    `claims/policies/${caseId}/employees${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`,
    ClaimMemberListResponseSchema,
    Boolean(caseId),
  );
export const claimFamilyQuery = (caseId: string, memberId: string) =>
  simple(
    ['family', caseId, memberId],
    `claims/policies/${caseId}/employees/${memberId}/family`,
    ClaimMemberListResponseSchema,
    Boolean(caseId && memberId),
  );
export const claimLinksQuery = () => simple(['links'], 'claims/links', ClaimLinkListResponseSchema);
export const claimTemplatesQuery = () =>
  simple(['templates'], 'claims/email-templates', ClaimEmailTemplateListResponseSchema);
export const claimHrContactQuery = (clientId: string) =>
  simple(
    ['hr-contact', clientId],
    `claims/hr-contacts/${clientId}`,
    ClaimHrContactSchema,
    Boolean(clientId),
  );

/** A change to claims: on success everything under ['claims'] is refreshed and a toast says so. */
export function useClaimMutation<TInput, TResult>(
  mutationFn: (input: TInput) => Promise<TResult>,
  success?: (result: TResult, input: TInput) => { title: string; description?: string } | null,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (result, input) => {
      void queryClient.invalidateQueries({ queryKey: claimKeys.all });
      const message = success?.(result, input);
      if (message) toast({ ...message, variant: 'success' });
    },
  });
}

export function uploadClaimDocument(claimId: string, kind: ClaimDocumentKind, file: File) {
  return apiFetch(
    `claims/${claimId}/documents?kind=${kind}&fileName=${encodeURIComponent(file.name)}`,
    {
      method: 'POST',
      body: file,
      schema: ClaimDocumentSchema,
    },
  );
}

/** A document's link through the proxy: inline to view in the browser, or as a download. */
export const claimDocumentHref = (claimId: string, fileId: string, inline = false) =>
  `/api/proxy/claims/${claimId}/documents/${fileId}${inline ? '?disposition=inline' : ''}`;

/** The API's field problems, joined, for an alert. */
export function issuesText(error: unknown): string | null {
  const details = (error as { details?: unknown } | null)?.details;
  if (!Array.isArray(details)) return null;
  const messages = (details as { message?: string }[]).map((item) => item.message).filter(Boolean);
  return messages.length > 0 ? messages.join(' ') : null;
}

/**
 * Calls the employee's link API through the public BFF route (no sign-in). The token travels in
 * a header, never in a URL, so it stays out of server logs and the browser history.
 */
export async function claimLinkFetch<T>(
  token: string,
  path: string,
  options: { method?: 'GET' | 'POST'; body?: unknown; schema: z.ZodType<T> },
): Promise<T> {
  const file = options.body instanceof Blob ? options.body : null;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Claim-Link-Token': token,
  };
  if (file) headers['Content-Type'] = file.type || 'application/octet-stream';
  else if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  let response: Response;
  try {
    response = await fetch(`/api/public/claim-link${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: file ?? (options.body === undefined ? undefined : JSON.stringify(options.body)),
      cache: 'no-store',
      credentials: 'omit',
    });
  } catch {
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'Cannot reach the server. Check your connection and try again.',
    );
  }
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = ApiErrorSchema.safeParse(data);
    throw parsed.success
      ? new ApiError(response.status, parsed.data.code, parsed.data.message, parsed.data.details)
      : new ApiError(
          response.status,
          'UNKNOWN_ERROR',
          `The request failed (${response.status}). Try again.`,
        );
  }
  return options.schema.parse(data);
}
