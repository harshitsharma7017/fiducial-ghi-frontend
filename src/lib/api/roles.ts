import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import {
  PERMISSIONS,
  RoleListResponseSchema,
  RoleRecordSchema,
  type CreateRoleRequest,
  type Permission,
  type RoleRecord,
  type UpdateRoleRequest,
} from '@/shared';

// Database-driven roles (Fiducial_backend docs/RBAC.md). The API is the authority: these calls
// only show and edit what it allows, and it re-checks every permission.

/** Every role with its permissions, status and number of users. */
export function rolesQuery() {
  return queryOptions({
    queryKey: queryKeys.roles,
    queryFn: ({ signal }) => apiFetch('roles', { schema: RoleListResponseSchema, signal }),
  });
}

/** The permissions a set of roles grants: the union of the active ones, in catalog order. */
export function effectivePermissions(
  roles: readonly RoleRecord[],
  keys: readonly string[],
): Permission[] {
  const granted = new Set<Permission>();
  for (const role of roles) {
    if (!role.active || !keys.includes(role.key)) continue;
    for (const permission of role.permissions) granted.add(permission);
  }
  return PERMISSIONS.filter((permission) => granted.has(permission));
}

function useInvalidateRoles() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.roles });
    // A change to a role the signed-in user holds changes what they may do.
    void queryClient.invalidateQueries({ queryKey: queryKeys.me });
  };
}

export function useCreateRole() {
  const invalidate = useInvalidateRoles();
  return useMutation({
    mutationFn: (body: CreateRoleRequest) =>
      apiFetch('roles', { method: 'POST', body, schema: RoleRecordSchema }),
    onSuccess: invalidate,
  });
}

export function useUpdateRole(key: string) {
  const invalidate = useInvalidateRoles();
  return useMutation({
    mutationFn: (body: UpdateRoleRequest) =>
      apiFetch(`roles/${key}`, { method: 'PATCH', body, schema: RoleRecordSchema }),
    onSuccess: invalidate,
  });
}

export function useSetRoleActive(key: string) {
  const invalidate = useInvalidateRoles();
  return useMutation({
    mutationFn: (active: boolean) =>
      apiFetch(`roles/${key}/${active ? 'activate' : 'deactivate'}`, {
        method: 'POST',
        schema: RoleRecordSchema,
      }),
    onSuccess: invalidate,
  });
}
