'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { History, LoaderCircle, Lock } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { EmptyState, ErrorState, TableLoadingRows } from '@/components/states';
import { CreateUserDialog } from '@/components/users/create-user-dialog';
import { EditRolesDialog, ToggleActiveDialog } from '@/components/users/user-actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useCurrentUser } from '@/hooks/use-current-user';
import { apiFetch } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import {
  UserListResponseSchema,
  formatDate,
  formatDateTime,
  hasPermission,
  type User,
} from '@/shared';

const COLUMNS = 6;

function StatusBadges({ user }: { user: User }) {
  return (
    <span className="flex flex-wrap gap-1">
      <Badge variant={user.active ? 'success' : 'muted'}>
        {user.active ? 'Active' : 'Inactive'}
      </Badge>
      {user.lockedUntil ? (
        <Badge variant="warning">
          <Lock className="size-3" aria-hidden="true" />
          Locked until {formatDateTime(user.lockedUntil)}
        </Badge>
      ) : null}
    </span>
  );
}

function UsersTable({
  currentUserId,
  showHistory,
  canAssignRoles,
  canDeactivate,
}: {
  currentUserId: string;
  /** Links each user to their record's history in the audit log (audit.view). */
  showHistory: boolean;
  /** Shows "Roles" (users.assign_roles). */
  canAssignRoles: boolean;
  /** Shows "Deactivate" / "Activate" (users.deactivate). */
  canDeactivate: boolean;
}) {
  const users = useInfiniteQuery({
    queryKey: queryKeys.users,
    queryFn: ({ pageParam, signal }) => {
      const params = new URLSearchParams({ limit: '50' });
      if (pageParam) params.set('cursor', pageParam);
      return apiFetch(`users?${params.toString()}`, { schema: UserListResponseSchema, signal });
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const items = users.data?.pages.flatMap((page) => page.items) ?? [];

  let body;
  if (users.isPending) body = <TableLoadingRows columns={COLUMNS} rows={4} />;
  else if (users.isError) {
    body = (
      <TableRow>
        <TableCell colSpan={COLUMNS} className="p-4">
          <ErrorState error={users.error} onRetry={() => void users.refetch()} />
        </TableCell>
      </TableRow>
    );
  } else if (items.length === 0) {
    body = (
      <TableRow>
        <TableCell colSpan={COLUMNS}>
          <EmptyState title="No users yet" />
        </TableCell>
      </TableRow>
    );
  } else {
    body = items.map((user) => {
      const isSelf = user.id === currentUserId;
      return (
        <TableRow key={user.id}>
          <TableCell className="font-medium">
            {user.name}
            {isSelf ? (
              <span className="ml-2 text-xs font-normal text-muted-foreground">(you)</span>
            ) : null}
          </TableCell>
          <TableCell className="break-all">{user.email}</TableCell>
          <TableCell>
            <span className="flex flex-wrap gap-1">
              {user.roleNames.map((name, index) => (
                <Badge key={user.roles[index] ?? name}>{name}</Badge>
              ))}
            </span>
          </TableCell>
          <TableCell>
            <StatusBadges user={user} />
          </TableCell>
          <TableCell className="tabular whitespace-nowrap">
            {user.lastLoginAt ? (
              formatDate(user.lastLoginAt)
            ) : (
              <span className="text-muted-foreground">Never</span>
            )}
          </TableCell>
          <TableCell className="text-right whitespace-nowrap">
            {showHistory ? (
              <Button asChild variant="ghost" size="sm">
                <Link href={`/audit?entity=user&entityId=${user.id}`}>
                  <History aria-hidden="true" />
                  History <span className="sr-only">of {user.name}</span>
                </Link>
              </Button>
            ) : null}
            {canAssignRoles ? <EditRolesDialog user={user} isSelf={isSelf} /> : null}
            {canDeactivate ? <ToggleActiveDialog user={user} isSelf={isSelf} /> : null}
          </TableCell>
        </TableRow>
      );
    });
  }

  return (
    <>
      <Card className="py-0">
        <Table>
          <TableCaption className="sr-only">Users</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Name</TableHead>
              <TableHead scope="col">Email</TableHead>
              <TableHead scope="col">Roles</TableHead>
              <TableHead scope="col">Status</TableHead>
              <TableHead scope="col">Last sign-in</TableHead>
              <TableHead scope="col" className="text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{body}</TableBody>
        </Table>
      </Card>
      {users.hasNextPage ? (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            onClick={() => void users.fetchNextPage()}
            disabled={users.isFetchingNextPage}
          >
            {users.isFetchingNextPage ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : null}
            Load more
          </Button>
        </div>
      ) : null}
    </>
  );
}

export function UsersView() {
  const me = useCurrentUser();
  const permissions = me.data?.permissions;
  const canView = hasPermission(permissions, 'users.view');
  const canCreate =
    hasPermission(permissions, 'users.create') && hasPermission(permissions, 'users.assign_roles');
  const canViewAudit = hasPermission(permissions, 'audit.view');

  return (
    <>
      <PageHeader
        title="Users"
        description="Create users, change roles and deactivate accounts. Every change is audited."
        actions={canCreate ? <CreateUserDialog /> : undefined}
      />
      {me.data && !canView ? (
        <Alert variant="warning" role="alert" className="max-w-xl">
          <Lock aria-hidden="true" />
          <AlertTitle>No access</AlertTitle>
          <AlertDescription>You need the View users permission (users.view).</AlertDescription>
        </Alert>
      ) : me.data ? (
        <UsersTable
          currentUserId={me.data.id}
          showHistory={canViewAudit}
          canAssignRoles={hasPermission(permissions, 'users.assign_roles')}
          canDeactivate={hasPermission(permissions, 'users.deactivate')}
        />
      ) : null}
    </>
  );
}
