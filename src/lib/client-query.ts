import { queryOptions, skipToken } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { ClientSchema } from '@/shared';

const OBJECT_ID = /^[a-f0-9]{24}$/i;

/**
 * One client by id, shared by the client page and its breadcrumb so both read the same cache
 * entry. An id that cannot be a client's (or none) is skipped rather than fetched.
 */
export function clientQuery(id: string | null) {
  return queryOptions({
    queryKey: queryKeys.clients.detail(id ?? ''),
    queryFn:
      id && OBJECT_ID.test(id)
        ? ({ signal }) => apiFetch(`clients/${id}`, { schema: ClientSchema, signal })
        : skipToken,
  });
}
