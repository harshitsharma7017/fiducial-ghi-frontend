'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LoaderCircle, Pencil, UserCheck, UserX } from 'lucide-react';
import { useState } from 'react';
import { errorMessage } from '@/components/states';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import {
  ADMIN_ROLE_KEY,
  UserRolesSchema,
  UserSchema,
  type UpdateUserRequest,
  type User,
} from '@/shared';
import { RolesFieldset } from './roles-fieldset';

function useUpdateUser(user: User, onDone: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (changes: UpdateUserRequest) =>
      apiFetch(`users/${user.id}`, { method: 'PATCH', body: changes, schema: UserSchema }),
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users });
      void queryClient.invalidateQueries({ queryKey: queryKeys.me });
      toast({
        title: 'User updated',
        description: `${updated.name} has been updated.`,
        variant: 'success',
      });
      onDone();
    },
  });
}

export function EditRolesDialog({ user, isSelf }: { user: User; isSelf: boolean }) {
  const [open, setOpen] = useState(false);
  const [roles, setRoles] = useState<string[]>(user.roles);
  const [validation, setValidation] = useState<string | undefined>();
  const update = useUpdateUser(user, () => setOpen(false));

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setRoles(user.roles);
          setValidation(undefined);
          update.reset();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={`Change roles for ${user.name}`}>
          <Pencil aria-hidden="true" />
          Roles
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Change roles</DialogTitle>
          <DialogDescription>
            {user.name} ({user.email})
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const parsed = UserRolesSchema.safeParse(roles);
            if (!parsed.success) {
              setValidation(parsed.error.issues[0]?.message);
              return;
            }
            update.mutate({ roles: parsed.data });
          }}
        >
          {update.isError ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{errorMessage(update.error)}</AlertDescription>
            </Alert>
          ) : null}
          <RolesFieldset
            value={roles}
            onChange={(next) => {
              setRoles(next);
              setValidation(undefined);
            }}
            // You cannot remove your own Administrator role.
            disabledRoles={isSelf && user.roles.includes(ADMIN_ROLE_KEY) ? [ADMIN_ROLE_KEY] : []}
            error={validation}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              ) : null}
              Save roles
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ToggleActiveDialog({ user, isSelf }: { user: User; isSelf: boolean }) {
  const [open, setOpen] = useState(false);
  const update = useUpdateUser(user, () => setOpen(false));
  const deactivating = user.active;

  if (isSelf && deactivating) {
    return (
      <Button variant="ghost" size="sm" disabled title="You cannot deactivate your own account">
        <UserX aria-hidden="true" />
        Deactivate
      </Button>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) update.reset();
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={`${deactivating ? 'Deactivate' : 'Activate'} ${user.name}`}
        >
          {deactivating ? <UserX aria-hidden="true" /> : <UserCheck aria-hidden="true" />}
          {deactivating ? 'Deactivate' : 'Activate'}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{deactivating ? 'Deactivate user' : 'Activate user'}</DialogTitle>
          <DialogDescription>
            {deactivating
              ? `${user.name} will be signed out on their next action and cannot sign in until reactivated.`
              : `${user.name} will be able to sign in again.`}
          </DialogDescription>
        </DialogHeader>
        {update.isError ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{errorMessage(update.error)}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant={deactivating ? 'destructive' : 'default'}
            disabled={update.isPending}
            onClick={() => update.mutate({ active: !user.active })}
          >
            {update.isPending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
            {deactivating ? 'Deactivate' : 'Activate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
