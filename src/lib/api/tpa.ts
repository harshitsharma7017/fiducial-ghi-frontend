import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import type { z } from 'zod';
import { toast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api-client';
import {
  ClaimImportSettingsResponseSchema,
  InsuredPolicyListResponseSchema,
  TpaClaimHistorySchema,
  TpaClaimListResponseSchema,
  TpaClaimRecordSchema,
  TpaFormatListResponseSchema,
  TpaImportListResponseSchema,
  TpaImportRowsResponseSchema,
  TpaImportSchema,
  TpaInspectResponseSchema,
  type EbProduct,
  type TpaClaimStatus,
} from '@/shared';

// TPA claims (N9, N11) from /api/v1/tpa through the proxy. Everything sits under ['tpa'] so one
// invalidation refreshes formats, imports and the imported claims; an import also changes the
// claims board, so ['claims'] is refreshed with it.

export const tpaKeys = { all: ['tpa'] as const };

const simple = <T>(key: readonly unknown[], path: string, schema: z.ZodType<T>, enabled = true) =>
  queryOptions({
    queryKey: ['tpa', ...key],
    queryFn: ({ signal }) => apiFetch(path, { schema, signal }),
    enabled,
  });

/** Placed policies (GMC, GPA, GTLI) for the policy pickers. */
export const insuredPoliciesQuery = (product?: EbProduct) =>
  simple(
    ['policies', product ?? 'ALL'],
    `tpa/policies${product ? `?product=${product}` : ''}`,
    InsuredPolicyListResponseSchema,
  );
export const tpaFormatsQuery = () =>
  simple(['formats'], 'tpa/formats', TpaFormatListResponseSchema);
export const tpaImportsQuery = (caseId: string) =>
  simple(
    ['imports', caseId],
    `tpa/imports?caseId=${caseId}`,
    TpaImportListResponseSchema,
    Boolean(caseId),
  );
export const tpaImportQuery = (importId: string) =>
  simple(['import', importId], `tpa/imports/${importId}`, TpaImportSchema, Boolean(importId));
export const tpaImportRowsQuery = (
  importId: string,
  only: 'ALL' | 'ERRORS' | 'WARNINGS',
  page: number,
) =>
  simple(
    ['import', importId, 'rows', only, page],
    `tpa/imports/${importId}/rows?only=${only}&page=${page}&limit=25`,
    TpaImportRowsResponseSchema,
    Boolean(importId),
  );
export const importSettingsQuery = () =>
  simple(['settings'], 'tpa/settings', ClaimImportSettingsResponseSchema);

export interface TpaClaimFilters {
  caseId: string;
  status: TpaClaimStatus | '';
  review: boolean;
  q: string;
  page: number;
}
export const tpaClaimsQuery = (filters: TpaClaimFilters) => {
  const params = new URLSearchParams({
    caseId: filters.caseId,
    page: String(filters.page),
    limit: '25',
  });
  if (filters.status) params.set('status', filters.status);
  if (filters.review) params.set('review', 'true');
  if (filters.q.trim()) params.set('q', filters.q.trim());
  return simple(
    ['claims', filters],
    `tpa/claims?${params.toString()}`,
    TpaClaimListResponseSchema,
    Boolean(filters.caseId),
  );
};
export const tpaClaimQuery = (claimId: string) =>
  simple(['claim', claimId], `tpa/claims/${claimId}`, TpaClaimRecordSchema, Boolean(claimId));
export const tpaClaimHistoryQuery = (claimId: string) =>
  simple(
    ['claim', claimId, 'history'],
    `tpa/claims/${claimId}/history`,
    TpaClaimHistorySchema,
    Boolean(claimId),
  );

/** Reads a file's sheets and headers against a format (or none), importing nothing. */
export function inspectTpaFile(
  file: File,
  options: { formatId?: string; sheetName?: string; headerRow?: number },
) {
  const params = new URLSearchParams({ fileName: file.name });
  if (options.formatId) params.set('formatId', options.formatId);
  if (options.sheetName) params.set('sheetName', options.sheetName);
  if (options.headerRow) params.set('headerRow', String(options.headerRow));
  return apiFetch(`tpa/inspect?${params.toString()}`, {
    method: 'POST',
    body: file,
    schema: TpaInspectResponseSchema,
  });
}

export function uploadTpaFile(caseId: string, formatId: string, file: File) {
  const params = new URLSearchParams({ caseId, formatId, fileName: file.name });
  return apiFetch(`tpa/imports?${params.toString()}`, {
    method: 'POST',
    body: file,
    schema: TpaImportSchema,
  });
}

/** A change to TPA data: on success TPA data and the claims board refresh, and a toast says so. */
export function useTpaMutation<TInput, TResult>(
  mutationFn: (input: TInput) => Promise<TResult>,
  success?: (result: TResult, input: TInput) => { title: string; description?: string } | null,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (result, input) => {
      void queryClient.invalidateQueries({ queryKey: tpaKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['claims'] });
      void queryClient.invalidateQueries({ queryKey: ['reports'] });
      const message = success?.(result, input);
      if (message) toast({ ...message, variant: 'success' });
    },
  });
}
