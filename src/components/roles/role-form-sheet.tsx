'use client';

import { LoaderCircle } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { errorMessage } from '@/components/states';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { usePermission } from '@/hooks/use-permission';
import { toast } from '@/hooks/use-toast';
import { ApiError } from '@/lib/api-client';
import { useCreateRole, useUpdateRole } from '@/lib/api/roles';
import {
  ERROR_CODES,
  ROLE_DESCRIPTION_MAX,
  RoleNameSchema,
  type Permission,
  type RoleRecord,
} from '@/shared';
import { PermissionPicker } from './permission-picker';

/**
 * Creates a role, or edits one: name and description (roles.update), and permissions
 * (roles.assign_permissions). System roles keep their names; the Administrator role is not
 * editable. The API refuses permissions the editor does not hold.
 */
export function RoleFormSheet({ role, trigger }: { role?: RoleRecord; trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const canRename = usePermission(role ? 'roles.update' : 'roles.create');
  const canChoosePermissions = usePermission('roles.assign_permissions');
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [permissions, setPermissions] = useState<Permission[]>(role?.permissions ?? []);
  const [nameError, setNameError] = useState<string | undefined>();
  const create = useCreateRole();
  const update = useUpdateRole(role?.key ?? '');
  const mutation = role ? update : create;
  // Seen by someone who may change neither the name nor the permissions: nothing to save.
  const readOnly = !canRename && !canChoosePermissions;

  const reset = () => {
    setName(role?.name ?? '');
    setDescription(role?.description ?? '');
    setPermissions(role?.permissions ?? []);
    setNameError(undefined);
    create.reset();
    update.reset();
  };

  const onSaved = (saved: RoleRecord) => {
    toast({
      title: role ? 'Role saved' : 'Role created',
      description: `${saved.name}: ${saved.permissions.length} permissions.`,
      variant: 'success',
    });
    setOpen(false);
  };
  const onError = (error: unknown) => {
    if (error instanceof ApiError && error.code === ERROR_CODES.ROLE_NAME_TAKEN) {
      setNameError('Another role already has this name');
    }
  };

  const submit = () => {
    const parsed = RoleNameSchema.safeParse(name);
    if (!parsed.success) {
      setNameError(parsed.error.issues[0]?.message);
      return;
    }
    if (!role) {
      create.mutate(
        { name: parsed.data, description, permissions },
        { onSuccess: onSaved, onError },
      );
      return;
    }
    update.mutate(
      {
        expectedVersion: role.version,
        ...(canRename && !role.isSystem && parsed.data !== role.name ? { name: parsed.data } : {}),
        ...(canRename && description !== role.description ? { description } : {}),
        ...(canChoosePermissions ? { permissions } : {}),
      },
      { onSuccess: onSaved, onError },
    );
  };

  const nameTaken =
    mutation.error instanceof ApiError && mutation.error.code === ERROR_CODES.ROLE_NAME_TAKEN;
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reset();
      }}
    >
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>{role ? `Edit ${role.name}` : 'New role'}</SheetTitle>
          <SheetDescription>
            Choose what users holding this role may do. Changes apply to their next request; no new
            sign-in is needed.
          </SheetDescription>
        </SheetHeader>
        <form
          noValidate
          className="grid gap-4 px-4 pb-6"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          {mutation.isError && !nameTaken ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{errorMessage(mutation.error)}</AlertDescription>
            </Alert>
          ) : null}
          <div className="grid gap-1.5">
            <Label htmlFor="role-name">Name</Label>
            <Input
              id="role-name"
              value={name}
              disabled={!canRename || role?.isSystem}
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? 'role-name-error' : undefined}
              onChange={(event) => {
                setName(event.target.value);
                setNameError(undefined);
              }}
            />
            {role?.isSystem ? (
              <p className="text-xs text-muted-foreground">System roles keep their names.</p>
            ) : null}
            {nameError ? (
              <p id="role-name-error" className="text-sm text-destructive">
                {nameError}
              </p>
            ) : null}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="role-description">Description</Label>
            <Textarea
              id="role-description"
              value={description}
              maxLength={ROLE_DESCRIPTION_MAX}
              disabled={!canRename}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <h3 className="text-sm font-medium">Permissions</h3>
            {canChoosePermissions ? null : (
              <p className="text-xs text-muted-foreground">
                You can see the permissions but not change them (needs Choose role permissions).
              </p>
            )}
            <PermissionPicker
              value={permissions}
              onChange={setPermissions}
              disabled={!canChoosePermissions}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {readOnly ? 'Close' : 'Cancel'}
            </Button>
            {readOnly ? null : (
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? (
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                ) : null}
                {role ? 'Save role' : 'Create role'}
              </Button>
            )}
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
