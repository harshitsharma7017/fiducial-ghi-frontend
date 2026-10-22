import { queryOptions, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { toast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api-client';
import {
  GhiCaseListResponseSchema,
  GhiCaseRecordSchema,
  GhiCensusImportSchema,
  GhiCensusIssueSchema,
  GhiCensusSummarySchema,
  GhiDocumentPreviewSchema,
  GhiFileListResponseSchema,
  GhiFileSchema,
  GhiFinalQcrStateSchema,
  GhiImportListResponseSchema,
  GhiMemberListResponseSchema,
  GhiMemberSchema,
  GhiPaymentsResponseSchema,
  GhiPlacementStateSchema,
  GhiQcrListResponseSchema,
  GhiQuoteListResponseSchema,
  GhiRfqStateSchema,
  EB_PRODUCT_SLUGS,
  type EbProduct,
  type GhiCaseInsurer,
  type GhiCaseType,
  type GhiFilePurpose,
  type GhiRelationship,
  type GhiStage,
} from '@/shared';

// Group health (GHI) data, from /api/v1/ghi through the proxy. Every query of a case sits under
// ['ghi', 'case', id], so one invalidation refreshes the case after any change.

export const ghiKeys = {
  all: ['ghi'] as const,
  list: (filters: unknown) => ['ghi', 'list', filters] as const,
  case: (id: string) => ['ghi', 'case', id] as const,
  part: (id: string, ...rest: unknown[]) => ['ghi', 'case', id, ...rest] as const,
};

export interface GhiListFilters {
  q: string;
  stage: GhiStage | '';
  type: GhiCaseType | '';
  page: number;
}

/**
 * The API path of a case of any product: GMC cases are under /ghi, GPA and GTLI under
 * /eb/{product}; the workflow paths below a case are the same for every product.
 */
export function caseApi(product: EbProduct, id: string): string {
  return product === 'GMC' ? `ghi/cases/${id}` : `eb/${EB_PRODUCT_SLUGS[product]}/cases/${id}`;
}

/** What the shared RFQ and insurer panels need of a case, whatever its product. */
export interface WorkflowCase {
  id: string;
  product: EbProduct;
  stage: GhiStage;
  dueDate: string;
  locked: boolean;
  placed: boolean;
  insurers: GhiCaseInsurer[];
}

/** A response the panel only needs to succeed (the case is read again afterwards). */
export const AnyRecordSchema = z.object({ id: z.string() }).passthrough();

export function ghiCasesQuery(filters: GhiListFilters) {
  const params = new URLSearchParams({ page: String(filters.page), limit: '20' });
  if (filters.q.trim()) params.set('q', filters.q.trim());
  if (filters.stage) params.set('stage', filters.stage);
  if (filters.type) params.set('type', filters.type);
  return queryOptions({
    queryKey: ghiKeys.list(filters),
    queryFn: ({ signal }) =>
      apiFetch(`ghi/cases?${params.toString()}`, { schema: GhiCaseListResponseSchema, signal }),
  });
}

export function ghiCaseQuery(id: string) {
  return queryOptions({
    queryKey: [...ghiKeys.case(id), 'record'],
    queryFn: ({ signal }) => apiFetch(`ghi/cases/${id}`, { schema: GhiCaseRecordSchema, signal }),
  });
}

const part = <T>(id: string, path: string, schema: z.ZodType<T>, ...key: unknown[]) =>
  queryOptions({
    queryKey: ghiKeys.part(id, path, ...key),
    queryFn: ({ signal }) => apiFetch(`ghi/cases/${id}/${path}`, { schema, signal }),
  });

export const ghiSummaryQuery = (id: string) => part(id, 'census/summary', GhiCensusSummarySchema);
export const ghiCensusIssuesQuery = (id: string) =>
  part(
    id,
    'census/issues',
    z.object({
      items: z.array(z.object({ member: GhiMemberSchema, issues: z.array(GhiCensusIssueSchema) })),
    }),
  );
export const ghiImportsQuery = (id: string) =>
  part(id, 'census/imports', GhiImportListResponseSchema);
export const ghiImportQuery = (id: string, importId: string) =>
  part(id, `census/imports/${importId}`, GhiCensusImportSchema);
export const ghiRfqQuery = (id: string, product: EbProduct = 'GMC') =>
  queryOptions({
    queryKey: ghiKeys.part(id, 'rfq'),
    queryFn: ({ signal }) =>
      apiFetch(`${caseApi(product, id)}/rfq`, { schema: GhiRfqStateSchema, signal }),
  });
export const ghiRfqPreviewQuery = (id: string, product: EbProduct = 'GMC') =>
  queryOptions({
    queryKey: ghiKeys.part(id, 'rfq/preview'),
    queryFn: ({ signal }) =>
      apiFetch(`${caseApi(product, id)}/rfq/preview`, { schema: GhiDocumentPreviewSchema, signal }),
  });
export const ghiQuotesQuery = (id: string) => part(id, 'quotes', GhiQuoteListResponseSchema);
export const ghiQcrsQuery = (id: string) => part(id, 'qcrs', GhiQcrListResponseSchema);
export const ghiFinalQuery = (id: string) => part(id, 'final-qcr', GhiFinalQcrStateSchema);
export const ghiPaymentsQuery = (id: string) => part(id, 'payments', GhiPaymentsResponseSchema);
export const ghiPlacementQuery = (id: string) => part(id, 'placement', GhiPlacementStateSchema);
export const ghiFilesQuery = (id: string, product: EbProduct = 'GMC') =>
  queryOptions({
    queryKey: ghiKeys.part(id, 'files'),
    queryFn: ({ signal }) =>
      apiFetch(`${caseApi(product, id)}/files`, { schema: GhiFileListResponseSchema, signal }),
  });

export function ghiMembersQuery(
  id: string,
  filters: { q: string; relationship: GhiRelationship | ''; page: number; limit: number },
) {
  const params = new URLSearchParams({ page: String(filters.page), limit: String(filters.limit) });
  if (filters.q.trim()) params.set('q', filters.q.trim());
  if (filters.relationship) params.set('relationship', filters.relationship);
  return queryOptions({
    queryKey: ghiKeys.part(id, 'members', filters),
    queryFn: ({ signal }) =>
      apiFetch(`ghi/cases/${id}/members?${params.toString()}`, {
        schema: GhiMemberListResponseSchema,
        signal,
      }),
  });
}

/** Refreshes everything shown for a case, and the case list. */
export function refreshGhiCase(queryClient: QueryClient, id: string): void {
  void queryClient.invalidateQueries({ queryKey: ghiKeys.case(id) });
  void queryClient.invalidateQueries({ queryKey: ['ghi', 'list'] });
  // Employee Benefits lists (GPA, GTLI and every product).
  void queryClient.invalidateQueries({ queryKey: ['eb'] });
}

/**
 * A change to a case: on success the case's data is refreshed and a toast says what happened.
 * Errors stay on the mutation for the form or panel to show.
 */
export function useGhiMutation<TInput, TResult>(
  caseId: string,
  mutationFn: (input: TInput) => Promise<TResult>,
  success?: (result: TResult, input: TInput) => { title: string; description?: string } | null,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (result, input) => {
      refreshGhiCase(queryClient, caseId);
      const message = success?.(result, input);
      if (message) toast({ ...message, variant: 'success' });
    },
  });
}

/** Uploads a file to the case for a purpose; the API checks its kind. */
export function uploadGhiFile(
  caseId: string,
  purpose: GhiFilePurpose,
  file: File,
  product: EbProduct = 'GMC',
) {
  return apiFetch(
    `${caseApi(product, caseId)}/files?purpose=${purpose}&fileName=${encodeURIComponent(file.name)}`,
    { method: 'POST', body: file, schema: GhiFileSchema },
  );
}

/** A case file's download link through the proxy. */
export const ghiFileHref = (caseId: string, fileId: string, product: EbProduct = 'GMC') =>
  `/api/proxy/${caseApi(product, caseId)}/files/${fileId}`;

/** The API's field problems, joined, for an alert. */
export function issuesText(error: unknown): string | null {
  const details = (error as { details?: unknown } | null)?.details;
  if (!Array.isArray(details)) return null;
  const messages = (details as { path?: string; message?: string }[])
    .map((item) => item.message)
    .filter(Boolean);
  return messages.length > 0 ? messages.join(' ') : null;
}
