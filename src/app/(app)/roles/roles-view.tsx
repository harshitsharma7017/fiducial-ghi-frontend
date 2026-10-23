'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Eye,
  LoaderCircle,
  Lock,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  ShieldOff,
} from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { RoleFormSheet } from '@/components/roles/role-form-sheet';
import { EmptyState, ErrorState, TableLoadingRows, errorMessage } from '@/components/states';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { usePermission } from '@/hooks/use-permission';
import { toast } from '@/hooks/use-toast';
import { rolesQuery, useSetRoleActive } from '@/lib/api/roles';
import { PERMISSIONS, formatDate, normalizeRoleName, type RoleRecord } from '@/shared';

const COLUMNS = 6;

function ActiveToggle({ role }: { role: RoleRecord }) {
  const [open, setOpen] = useState(false);
  const toggle = useSetRoleActive(role.key);
  const deactivating = role.active;
  // A role still assigned cannot be deactivated (the API refuses with ROLE_IN_USE).
  if (deactivating && role.userCount > 0) {
    return (
      <Button
        variant="ghost"
        size="sm"
        disabled
        title={`Assigned to ${role.userCount} user${role.userCount === 1 ? '' : 's'}: change their roles first`}
      >
        <ShieldOff aria-hidden="true" />
        Deactivate
      </Button>
    );
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) toggle.reset();
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={`${deactivating ? 'Deactivate' : 'Activate'} ${role.name}`}
        >
          {deactivating ? <ShieldOff aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />}
          {deactivating ? 'Deactivate' : 'Activate'}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{deactivating ? 'Deactivate role' : 'Activate role'}</DialogTitle>
          <DialogDescription>
            {deactivating
              ? `${role.name} will grant nothing and cannot be assigned until it is activated again.`
              : `${role.name} can be assigned again and grants its permissions to those who hold it.`}
          </DialogDescription>
        </DialogHeader>
        {toggle.isError ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{errorMessage(toggle.error)}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant={deactivating ? 'destructive' : 'default'}
            disabled={toggle.isPending}
            onClick={() =>
              toggle.mutate(!role.active, {
                onSuccess: (saved) => {
                  toast({
                    title: saved.active ? 'Role activated' : 'Role deactivated',
                    description: saved.name,
                    variant: 'success',
                  });
                  setOpen(false);
                },
              })
            }
          >
            {toggle.isPending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
            {deactivating ? 'Deactivate' : 'Activate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Roles (roles.view): search, permission and user counts, and the actions the user may take. */
export function RolesView() {
  const roles = useQuery(rolesQuery());
  const canCreate = usePermission('roles.create');
  const canEdit = usePermission('roles.update');
  const canChoosePermissions = usePermission('roles.assign_permissions');
  const canToggle = usePermission('roles.deactivate');
  const [query, setQuery] = useState('');
  const needle = normalizeRoleName(query);
  const items = (roles.data?.items ?? []).filter(
    (role) =>
      !needle ||
      normalizeRoleName(role.name).includes(needle) ||
      role.description.toLowerCase().includes(needle) ||
      role.key.toLowerCase().includes(needle),
  );

  let body;
  if (roles.isPending) body = <TableLoadingRows columns={COLUMNS} />;
  else if (roles.isError) {
    body = (
      <TableRow>
        <TableCell colSpan={COLUMNS}>
          <ErrorState error={roles.error} onRetry={() => void roles.refetch()} />
        </TableCell>
      </TableRow>
    );
  } else if (items.length === 0) {
    body = (
      <TableRow>
        <TableCell colSpan={COLUMNS}>
          <EmptyState title="No roles match" description="Try another search." />
        </TableCell>
      </TableRow>
    );
  } else {
    body = items.map((role) => (
      <TableRow key={role.key}>
        <TableCell>
          <span className="flex flex-wrap items-center gap-1 font-medium">
            {role.name}
            {role.locked ? (
              <Badge variant="muted">
                <Lock className="size-3" aria-hidden="true" />
                Locked
              </Badge>
            ) : role.isSystem ? (
              <Badge variant="muted">System</Badge>
            ) : null}
          </span>
          <span className="block text-xs text-muted-foreground">{role.description}</span>
        </TableCell>
        <TableCell className="tabular">
          {role.allPermissions ? 'All' : `${role.permissions.length} of ${PERMISSIONS.length}`}
        </TableCell>
        <TableCell className="tabular">{role.userCount}</TableCell>
        <TableCell>
          <Badge variant={role.active ? 'success' : 'muted'}>
            {role.active ? 'Active' : 'Inactive'}
          </Badge>
        </TableCell>
        <TableCell className="tabular whitespace-nowrap">{formatDate(role.updatedAt)}</TableCell>
        <TableCell className="text-right whitespace-nowrap">
          {role.locked ? null : canEdit || canChoosePermissions ? (
            <RoleFormSheet
              role={role}
              trigger={
                <Button variant="ghost" size="sm" aria-label={`Edit ${role.name}`}>
                  <Pencil aria-hidden="true" />
                  Edit
                </Button>
              }
            />
          ) : null}
          {role.locked || canEdit || canChoosePermissions ? null : (
            <RoleFormSheet
              role={role}
              trigger={
                <Button variant="ghost" size="sm" aria-label={`View ${role.name}`}>
                  <Eye aria-hidden="true" />
                  View
                </Button>
              }
            />
          )}
          {canToggle && !role.locked ? <ActiveToggle role={role} /> : null}
        </TableCell>
      </TableRow>
    ));
  }

  return (
    <>
      <PageHeader
        title="Roles"
        description="Each role grants a set of permissions; a user holds one or more roles. Changes apply to the next request of every user holding the role. Every change is audited."
        actions={
          canCreate ? (
            <RoleFormSheet
              trigger={
                <Button>
                  <Plus aria-hidden="true" />
                  New role
                </Button>
              }
            />
          ) : undefined
        }
      />
      <div className="relative mb-4 max-w-sm">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground"
        />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search roles"
          aria-label="Search roles"
          className="pl-8"
        />
      </div>
      <Card className="py-0">
        <Table>
          <TableCaption className="sr-only">Roles</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Role</TableHead>
              <TableHead>Permissions</TableHead>
              <TableHead>Users</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{body}</TableBody>
        </Table>
      </Card>
    </>
  );
}
