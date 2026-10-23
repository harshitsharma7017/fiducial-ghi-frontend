'use client';

import { useQuery } from '@tanstack/react-query';
import { useId } from 'react';
import { EffectivePermissions } from '@/components/roles/effective-permissions';
import { ErrorState, LoadingState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { effectivePermissions, rolesQuery } from '@/lib/api/roles';
import { PERMISSIONS } from '@/shared';

/**
 * Chooses a user's roles from the roles the API holds (any role an administrator created appears
 * here), with each role's description, and shows the permissions the chosen roles grant. Inactive
 * roles cannot be chosen; a role the user already holds stays visible. The API validates every
 * assignment (existing, active, within the assigner's own permissions).
 */
export function RolesFieldset({
  value,
  onChange,
  disabledRoles = [],
  error,
  legend = 'Roles',
}: {
  value: string[];
  onChange: (roles: string[]) => void;
  /** Role keys that cannot be changed here (your own Administrator role). */
  disabledRoles?: string[];
  error?: string;
  legend?: string;
}) {
  const baseId = useId();
  const errorId = `${baseId}-error`;
  const roles = useQuery(rolesQuery());

  if (roles.isPending) return <LoadingState label="Loading roles…" />;
  if (roles.isError) return <ErrorState error={roles.error} onRetry={() => void roles.refetch()} />;

  const shown = roles.data.items.filter((role) => role.active || value.includes(role.key));
  return (
    <div className="grid gap-3">
      <fieldset
        className="grid gap-2"
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? true : undefined}
      >
        <legend className="mb-1 text-sm font-medium">{legend}</legend>
        {shown.map((role) => {
          const id = `${baseId}-${role.key}`;
          const checked = value.includes(role.key);
          return (
            <div key={role.key} className="flex items-start gap-2">
              <Checkbox
                id={id}
                checked={checked}
                disabled={disabledRoles.includes(role.key) || (!role.active && !checked)}
                onCheckedChange={(state) =>
                  onChange(
                    state === true
                      ? [...value, role.key]
                      : value.filter((current) => current !== role.key),
                  )
                }
                className="mt-0.5"
              />
              <Label htmlFor={id} className="grid gap-0.5 font-normal">
                <span className="flex flex-wrap items-center gap-1 font-medium">
                  {role.name}
                  {role.active ? null : <Badge variant="muted">Inactive: grants nothing</Badge>}
                </span>
                <span className="text-xs text-muted-foreground">
                  {role.description || 'No description'} ·{' '}
                  {role.allPermissions
                    ? 'every permission'
                    : `${role.permissions.length} of ${PERMISSIONS.length} permissions`}
                </span>
              </Label>
            </div>
          );
        })}
        {error ? (
          <p id={errorId} className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </fieldset>
      <EffectivePermissions permissions={effectivePermissions(roles.data.items, value)} />
    </div>
  );
}
