'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { CurrentUserSchema, type CurrentUser } from '@/shared';

/**
 * The signed-in user, from GET /auth/me through the proxy, with the permissions of their active
 * roles as the API resolved them. Kept for a minute, so a role change shows up promptly; the API
 * applies it to the very next request regardless.
 */
export function useCurrentUser() {
  return useQuery<CurrentUser>({
    queryKey: queryKeys.me,
    queryFn: ({ signal }) => apiFetch('auth/me', { schema: CurrentUserSchema, signal }),
    staleTime: 60_000,
  });
}
