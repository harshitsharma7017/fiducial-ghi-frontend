'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import type { AuditFilters } from '@/lib/audit-display';
import { queryKeys } from '@/lib/query-keys';
import { AuditLogListResponseSchema } from '@/shared';

const PAGE_SIZE = 25;

/** The audit log, newest first, a page at a time ("Load more" passes the cursor back). */
export function useAuditLog(filters: AuditFilters) {
  return useInfiniteQuery({
    queryKey: queryKeys.auditLog(filters),
    queryFn: ({ pageParam, signal }) => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (filters.kind) params.set('kind', filters.kind);
      if (filters.entity) params.set('entity', filters.entity);
      if (filters.entity && filters.entityId) params.set('entityId', filters.entityId);
      if (filters.actorId) params.set('actorId', filters.actorId);
      if (pageParam) params.set('cursor', pageParam);
      return apiFetch(`audit?${params.toString()}`, {
        schema: AuditLogListResponseSchema,
        signal,
      });
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}
