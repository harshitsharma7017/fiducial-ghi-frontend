'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { UserSchema, type User } from '@/shared';

/** The signed-in user, from GET /auth/me through the proxy. */
export function useCurrentUser() {
  return useQuery<User>({
    queryKey: queryKeys.me,
    queryFn: ({ signal }) => apiFetch('auth/me', { schema: UserSchema, signal }),
    staleTime: 5 * 60_000,
  });
}
