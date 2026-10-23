'use client';

import { Search, ShieldAlert } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PERMISSIONS, PERMISSION_GROUPS, permissionInfo, type Permission } from '@/shared';

/** Permissions a selection still needs for its screens to work (shown as hints, never added). */
export function missingRequirements(
  selected: readonly Permission[],
): Map<Permission, Permission[]> {
  const missing = new Map<Permission, Permission[]>();
  for (const permission of selected) {
    const needs = (permissionInfo(permission).requires ?? []).filter((p) => !selected.includes(p));
    if (needs.length > 0) missing.set(permission, needs);
  }
  return missing;
}

function matches(permission: Permission, needle: string): boolean {
  if (!needle) return true;
  const info = permissionInfo(permission);
  return [info.key, info.label, info.description].some((text) =>
    text.toLowerCase().includes(needle),
  );
}

/**
 * The catalog of permissions as checkboxes, grouped, with search, select all / clear per group,
 * the selected count, each permission's description, a mark on sensitive ones and the
 * permissions a choice also needs. The API re-checks every permission it is sent.
 */
export function PermissionPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: readonly Permission[];
  onChange: (permissions: Permission[]) => void;
  disabled?: boolean;
}) {
  const baseId = useId();
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const missing = useMemo(() => missingRequirements(value), [value]);

  const set = (permissions: Iterable<Permission>) => {
    const chosen = new Set(permissions);
    // Keep catalog order, so a saved role reads the same way every time.
    onChange(PERMISSIONS.filter((permission) => chosen.has(permission)));
  };
  const toggle = (permission: Permission, on: boolean) => {
    const next = new Set(value);
    if (on) next.add(permission);
    else next.delete(permission);
    set(next);
  };

  const groups = PERMISSION_GROUPS.map((group) => ({
    ...group,
    shown: group.permissions.filter((permission) => matches(permission.key, needle)),
  })).filter((group) => group.shown.length > 0);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative w-full max-w-xs">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground"
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search permissions"
            aria-label="Search permissions"
            className="pl-8"
          />
        </div>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {value.length} of {PERMISSIONS.length} permissions selected
        </p>
      </div>
      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">No permission matches “{query}”.</p>
      ) : null}
      {groups.map((group) => {
        const keys = group.shown.map((permission) => permission.key);
        const chosen = keys.filter((key) => value.includes(key)).length;
        return (
          <fieldset
            key={group.key}
            className="grid gap-2 rounded-md border p-3"
            disabled={disabled}
          >
            <legend className="px-1 text-sm font-medium">
              {group.label}{' '}
              <span className="font-normal text-muted-foreground">
                ({chosen}/{keys.length})
              </span>
            </legend>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">{group.description}</p>
              <span className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={disabled || chosen === keys.length}
                  onClick={() => set([...value, ...keys])}
                >
                  Select all<span className="sr-only"> in {group.label}</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={disabled || chosen === 0}
                  onClick={() => set(value.filter((p) => !keys.includes(p)))}
                >
                  Clear<span className="sr-only"> {group.label}</span>
                </Button>
              </span>
            </div>
            <ul className="grid gap-2 sm:grid-cols-2">
              {group.shown.map((permission) => {
                const id = `${baseId}-${permission.key}`;
                const needs = missing.get(permission.key);
                return (
                  <li key={permission.key} className="flex items-start gap-2">
                    <Checkbox
                      id={id}
                      checked={value.includes(permission.key)}
                      onCheckedChange={(state) => toggle(permission.key, state === true)}
                      className="mt-0.5"
                      aria-describedby={`${id}-description`}
                    />
                    <Label htmlFor={id} className="grid gap-0.5 font-normal">
                      <span className="flex flex-wrap items-center gap-1 font-medium">
                        {permission.label}
                        {permission.sensitive ? (
                          <Badge variant="warning">
                            <ShieldAlert className="size-3" aria-hidden="true" />
                            Sensitive
                          </Badge>
                        ) : null}
                      </span>
                      <span id={`${id}-description`} className="text-xs text-muted-foreground">
                        {permission.description}{' '}
                        <code className="text-[0.7rem]">{permission.key}</code>
                      </span>
                      {needs ? (
                        <span className="text-xs text-warning">
                          Its screens also need:{' '}
                          {needs.map((p) => permissionInfo(p).label).join(', ')}
                        </span>
                      ) : null}
                    </Label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        );
      })}
    </div>
  );
}
