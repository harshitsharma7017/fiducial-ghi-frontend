import { queryOptions } from '@tanstack/react-query';
import { z } from 'zod';
import { apiFetch } from '@/lib/api-client';
import { caseApi, ghiKeys } from '@/lib/api/ghi';
import {
  AgeBandSetListResponseSchema,
  EbCaseListResponseSchema,
  EbCaseRecordSchema,
  EbCensusImportSchema,
  EbCensusIssuesResponseSchema,
  EbEmployeeListResponseSchema,
  EbImportListResponseSchema,
  EbMemberListResponseSchema,
  EbPaymentsResponseSchema,
  EbPlacementStateSchema,
  EbPlanDefaultsResponseSchema,
  EbQcrListResponseSchema,
  EbQuoteListResponseSchema,
  FamilyPlanListResponseSchema,
  FamilyPlanOpenCasesResponseSchema,
  FamilyPlanSchema,
  GhiCensusSummarySchema,
  GhiFileListResponseSchema,
  RfqSelectionSummaryResponseSchema,
  type EbImportMode,
  type EbProduct,
  type EbRoutedProduct,
  type GhiCaseType,
  type GhiRelationship,
  type GhiStage,
} from '@/shared';

// Employee Benefits data through the proxy: GPA and GTLI cases (/eb/{product}), the lists of
// every product (/eb/cases), templates, company employees and plan defaults, and the Family Plan
// Master (/family-plans). Every query of a case sits under ['ghi', 'case', id], as GMC's do, so
// one invalidation (useGhiMutation) refreshes the case after any change.

export const ebKeys = {
  all: ['eb'] as const,
  list: (product: EbProduct | 'ALL', filters: unknown) => ['eb', 'list', product, filters] as const,
  plans: ['eb', 'family-plans'] as const,
  company: (clientId: string) => ['eb', 'company', clientId] as const,
};

export interface EbListFilters {
  q: string;
  stage: GhiStage | '';
  type: GhiCaseType | '';
  page: number;
}

export function ebCasesQuery(product: EbProduct | 'ALL', filters: EbListFilters) {
  const params = new URLSearchParams({ page: String(filters.page), limit: '20' });
  if (product !== 'ALL') params.set('product', product);
  if (filters.q.trim()) params.set('q', filters.q.trim());
  if (filters.stage) params.set('stage', filters.stage);
  if (filters.type) params.set('type', filters.type);
  return queryOptions({
    queryKey: ebKeys.list(product, filters),
    queryFn: ({ signal }) =>
      apiFetch(`eb/cases?${params.toString()}`, { schema: EbCaseListResponseSchema, signal }),
  });
}

export function ebCaseQuery(product: EbRoutedProduct, id: string) {
  return queryOptions({
    queryKey: [...ghiKeys.case(id), 'record'],
    queryFn: ({ signal }) => apiFetch(caseApi(product, id), { schema: EbCaseRecordSchema, signal }),
  });
}

const part = <T>(
  product: EbProduct,
  id: string,
  path: string,
  schema: z.ZodType<T>,
  ...key: unknown[]
) =>
  queryOptions({
    queryKey: ghiKeys.part(id, path, ...key),
    queryFn: ({ signal }) => apiFetch(`${caseApi(product, id)}/${path}`, { schema, signal }),
  });

export const ebSummaryQuery = (product: EbProduct, id: string) =>
  part(product, id, 'census/summary', GhiCensusSummarySchema);
export const ebIssuesQuery = (product: EbProduct, id: string) =>
  part(product, id, 'census/issues', EbCensusIssuesResponseSchema);
export const ebImportsQuery = (product: EbProduct, id: string) =>
  part(product, id, 'census/imports', EbImportListResponseSchema);
export const ebImportQuery = (
  product: EbProduct,
  id: string,
  importId: string,
  mode: EbImportMode,
) =>
  queryOptions({
    queryKey: ghiKeys.part(id, `census/imports/${importId}`, mode),
    queryFn: ({ signal }) =>
      apiFetch(`${caseApi(product, id)}/census/imports/${importId}?mode=${mode}`, {
        schema: EbCensusImportSchema,
        signal,
      }),
  });
export const ebQuotesQuery = (product: EbProduct, id: string) =>
  part(product, id, 'quotes', EbQuoteListResponseSchema);
export const ebQcrsQuery = (product: EbProduct, id: string) =>
  part(product, id, 'qcrs', EbQcrListResponseSchema);
export const ebPaymentsQuery = (product: EbProduct, id: string) =>
  part(product, id, 'payments', EbPaymentsResponseSchema);
export const ebPlacementQuery = (product: EbProduct, id: string) =>
  part(product, id, 'placement', EbPlacementStateSchema);
export const ebFilesQuery = (product: EbProduct, id: string) =>
  part(product, id, 'files', GhiFileListResponseSchema);

export function ebMembersQuery(
  product: EbProduct,
  id: string,
  filters: { q: string; relationship: GhiRelationship | ''; page: number; limit: number },
) {
  const params = new URLSearchParams({ page: String(filters.page), limit: String(filters.limit) });
  if (filters.q.trim()) params.set('q', filters.q.trim());
  if (filters.relationship) params.set('relationship', filters.relationship);
  return queryOptions({
    queryKey: ghiKeys.part(id, 'members', filters),
    queryFn: ({ signal }) =>
      apiFetch(`${caseApi(product, id)}/members?${params.toString()}`, {
        schema: EbMemberListResponseSchema,
        signal,
      }),
  });
}

// Family Plan Master

export function familyPlansQuery(product?: EbProduct) {
  return queryOptions({
    queryKey: [...ebKeys.plans, 'list', product ?? 'ALL'],
    queryFn: ({ signal }) =>
      apiFetch(`family-plans${product ? `?product=${product}` : ''}`, {
        schema: FamilyPlanListResponseSchema,
        signal,
      }),
  });
}

export function familyPlanQuery(planId: string) {
  return queryOptions({
    queryKey: [...ebKeys.plans, planId],
    queryFn: ({ signal }) =>
      apiFetch(`family-plans/${planId}`, { schema: FamilyPlanSchema, signal }),
  });
}

export function familyPlanOpenCasesQuery(planId: string, enabled = true) {
  return queryOptions({
    queryKey: [...ebKeys.plans, planId, 'open-cases'],
    queryFn: ({ signal }) =>
      apiFetch(`family-plans/${planId}/open-cases`, {
        schema: FamilyPlanOpenCasesResponseSchema,
        signal,
      }),
    enabled,
  });
}

// Company: employees and default plans

export function companyEmployeesQuery(clientId: string, q: string, page: number) {
  const params = new URLSearchParams({ page: String(page) });
  if (q.trim()) params.set('q', q.trim());
  return queryOptions({
    queryKey: [...ebKeys.company(clientId), 'employees', q, page],
    queryFn: ({ signal }) =>
      apiFetch(`eb/companies/${clientId}/employees?${params.toString()}`, {
        schema: EbEmployeeListResponseSchema,
        signal,
      }),
  });
}

export function planDefaultsQuery(clientId: string) {
  return queryOptions({
    queryKey: [...ebKeys.company(clientId), 'plan-defaults'],
    queryFn: ({ signal }) =>
      apiFetch(`eb/companies/${clientId}/plan-defaults`, {
        schema: EbPlanDefaultsResponseSchema,
        signal,
      }),
  });
}

/** The census template download path (through the proxy), for a plan or a case. */
export function templatePath(
  product: EbProduct,
  options: { planId?: string; caseId?: string },
): string {
  const params = new URLSearchParams({ product });
  if (options.planId) params.set('planId', options.planId);
  if (options.caseId) params.set('caseId', options.caseId);
  return `eb/census-templates?${params.toString()}`;
}

/** A case file's download link through the proxy, for any product. */
export const caseFileHref = (product: EbProduct, caseId: string, fileId: string) =>
  `/api/proxy/${caseApi(product, caseId)}/files/${fileId}`;

// Age Band Master (N4) and the RFQ selection summary (N7)

const AgeBandCasesResponseSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      product: z.enum(['GMC', 'GPA', 'GTLI']),
      reference: z.string(),
      stage: z.string(),
      revision: z.number().int(),
      outdated: z.boolean(),
    }),
  ),
});

export const ageBandKeys = { all: ['age-bands'] as const };

export function ageBandSetsQuery(active?: boolean) {
  return queryOptions({
    queryKey: [...ageBandKeys.all, 'list', active ?? 'all'],
    queryFn: ({ signal }) =>
      apiFetch(`age-bands${active === undefined ? '' : `?active=${String(active)}`}`, {
        schema: AgeBandSetListResponseSchema,
        signal,
      }),
  });
}

export function ageBandCasesQuery(setId: string, enabled = true) {
  return queryOptions({
    queryKey: [...ageBandKeys.all, setId, 'cases'],
    queryFn: ({ signal }) =>
      apiFetch(`age-bands/${setId}/cases`, { schema: AgeBandCasesResponseSchema, signal }),
    enabled,
  });
}

/** The selection summary of any product's case, from the census as it is now. */
export function selectionSummaryQuery(product: EbProduct, id: string) {
  return queryOptions({
    queryKey: ghiKeys.part(id, 'rfq/selection-summary'),
    queryFn: ({ signal }) =>
      apiFetch(`${caseApi(product, id)}/rfq/selection-summary`, {
        schema: RfqSelectionSummaryResponseSchema,
        signal,
      }),
  });
}

/** The selection summary an RFQ version was generated with. */
export function rfqVersionSummaryQuery(product: EbProduct, id: string, rfqId: string | null) {
  return queryOptions({
    queryKey: ghiKeys.part(id, 'rfq/versions/selection-summary', rfqId),
    queryFn: ({ signal }) =>
      apiFetch(`${caseApi(product, id)}/rfq/versions/${rfqId ?? ''}/selection-summary`, {
        schema: RfqSelectionSummaryResponseSchema,
        signal,
      }),
    enabled: rfqId !== null,
  });
}
