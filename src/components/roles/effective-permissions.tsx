'use client';

import { ShieldAlert } from 'lucide-react';
import { PERMISSION_GROUPS, type Permission } from '@/shared';

/**
 * What a set of roles lets a user do, grouped as in the catalog (read-only). Shown on the user form
 * so an administrator sees the effect of the roles they choose; the API decides on each request.
 */
export function EffectivePermissions({
  permissions,
  title = 'Effective permissions',
}: {
  permissions: readonly Permission[];
  title?: string;
}) {
  const groups = PERMISSION_GROUPS.map((group) => ({
    label: group.label,
    granted: group.permissions.filter((permission) => permissions.includes(permission.key)),
  })).filter((group) => group.granted.length > 0);
  return (
    <section aria-label={title} className="grid gap-2 rounded-md border bg-muted/40 p-3">
      <h3 className="text-sm font-medium">
        {title} <span className="font-normal text-muted-foreground">({permissions.length})</span>
      </h3>
      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">None: choose at least one active role.</p>
      ) : (
        <dl className="grid gap-1.5 text-sm">
          {groups.map((group) => (
            <div key={group.label}>
              <dt className="text-xs font-medium text-muted-foreground">{group.label}</dt>
              <dd className="flex flex-wrap gap-x-3 gap-y-0.5">
                {group.granted.map((permission) => (
                  <span key={permission.key} className="inline-flex items-center gap-1">
                    {permission.sensitive ? (
                      <ShieldAlert
                        className="size-3 text-warning"
                        aria-label="Sensitive"
                        role="img"
                      />
                    ) : null}
                    {permission.label}
                  </span>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
