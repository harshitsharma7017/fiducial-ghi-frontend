import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api-client';
import {
  AgeBandSetListResponseSchema,
  ClaimsAnalysisResponseSchema,
  PremiumAdjustmentListResponseSchema,
  RecordedPolicyYearListResponseSchema,
  RenewalAnalysisSchema,
  RenewalOptionsResponseSchema,
  SavedRenewalReportListResponseSchema,
  SavedRenewalReportSchema,
  type EbProduct,
  type GhiRelationship,
  type OutstandingBasis,
  type TpaClaimStatus,
  type TpaClaimType,
  type TpaRequestType,
} from '@/shared';

// The claims analysis (N10) and the renewal analysis (N8), under ['reports'].

export interface ClaimsAnalysisFilters {
  caseId: string;
  from: string;
  to: string;
  asOf: string;
  status: TpaClaimStatus | '';
  claimType: TpaClaimType | '';
  requestType: TpaRequestType | '';
  member: 'MAIN' | 'DEPENDANT' | '';
  relationship: GhiRelationship | '';
  ageBandSetId: string;
  outstandingBasis: OutstandingBasis;
  q: string;
  page: number;
}

/** The query string of an analysis (also used for its download). */
export function claimsAnalysisParams(filters: ClaimsAnalysisFilters, withPage = true): string {
  const params = new URLSearchParams({ caseId: filters.caseId });
  for (const key of [
    'from',
    'to',
    'asOf',
    'status',
    'claimType',
    'requestType',
    'member',
    'relationship',
    'ageBandSetId',
  ] as const) {
    if (filters[key]) params.set(key, filters[key]);
  }
  params.set('outstandingBasis', filters.outstandingBasis);
  if (filters.q.trim()) params.set('q', filters.q.trim());
  if (withPage) {
    params.set('page', String(filters.page));
    params.set('limit', '25');
  }
  return params.toString();
}

export const claimsAnalysisQuery = (filters: ClaimsAnalysisFilters) =>
  queryOptions({
    queryKey: ['reports', 'claims-analysis', filters],
    queryFn: ({ signal }) =>
      apiFetch(`claims-analysis?${claimsAnalysisParams(filters)}`, {
        schema: ClaimsAnalysisResponseSchema,
        signal,
      }),
    enabled: Boolean(filters.caseId),
  });

export const premiumAdjustmentsQuery = (caseId: string) =>
  queryOptions({
    queryKey: ['reports', 'premium', caseId],
    queryFn: ({ signal }) =>
      apiFetch(`claims-analysis/premium/${caseId}`, {
        schema: PremiumAdjustmentListResponseSchema,
        signal,
      }),
    enabled: Boolean(caseId),
  });

export const ageBandSetsQuery = () =>
  queryOptions({
    queryKey: ['age-bands', 'list', 'active'],
    queryFn: ({ signal }) =>
      apiFetch('age-bands?active=true', { schema: AgeBandSetListResponseSchema, signal }),
  });

export const renewalOptionsQuery = (clientId: string, product: EbProduct) =>
  queryOptions({
    queryKey: ['reports', 'renewal-options', clientId, product],
    queryFn: ({ signal }) =>
      apiFetch(`renewal/options?clientId=${clientId}&product=${product}`, {
        schema: RenewalOptionsResponseSchema,
        signal,
      }),
    enabled: Boolean(clientId),
  });

export const recordedYearsQuery = (clientId: string, product: EbProduct) =>
  queryOptions({
    queryKey: ['reports', 'recorded-years', clientId, product],
    queryFn: ({ signal }) =>
      apiFetch(`renewal/years?clientId=${clientId}&product=${product}`, {
        schema: RecordedPolicyYearListResponseSchema,
        signal,
      }),
    enabled: Boolean(clientId),
  });

export interface RenewalRequest {
  clientId: string;
  product: EbProduct;
  years: Array<{ source: 'POLICY' | 'RECORDED'; id: string }>;
  upcomingCaseId: string | null;
  asOf?: string;
}

export const renewalAnalysisQuery = (body: RenewalRequest | null) =>
  queryOptions({
    queryKey: ['reports', 'renewal-analysis', body],
    queryFn: ({ signal }) =>
      apiFetch('renewal/analysis', {
        method: 'POST',
        body,
        schema: RenewalAnalysisSchema,
        signal,
      }),
    enabled: body !== null && body.years.length > 0,
  });

export const savedReportsQuery = (clientId: string) =>
  queryOptions({
    queryKey: ['reports', 'saved', clientId],
    queryFn: ({ signal }) =>
      apiFetch(`renewal/reports?clientId=${clientId}`, {
        schema: SavedRenewalReportListResponseSchema,
        signal,
      }),
    enabled: Boolean(clientId),
  });

export const savedReportQuery = (reportId: string) =>
  queryOptions({
    queryKey: ['reports', 'saved-report', reportId],
    queryFn: ({ signal }) =>
      apiFetch(`renewal/reports/${reportId}`, { schema: SavedRenewalReportSchema, signal }),
    enabled: Boolean(reportId),
  });

/** A change behind a report: on success every report refreshes and a toast says so. */
export function useReportMutation<TInput, TResult>(
  mutationFn: (input: TInput) => Promise<TResult>,
  success?: (result: TResult, input: TInput) => { title: string; description?: string } | null,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (result, input) => {
      void queryClient.invalidateQueries({ queryKey: ['reports'] });
      const message = success?.(result, input);
      if (message) toast({ ...message, variant: 'success' });
    },
  });
}
