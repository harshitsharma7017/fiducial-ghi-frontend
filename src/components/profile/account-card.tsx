'use client';

import { UserCog } from 'lucide-react';
import { LoadingState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCurrentUser } from '@/hooks/use-current-user';
import { formatDateTime } from '@/shared';

/** The signed-in user's name, email, roles and last sign-in. */
export function AccountCard() {
  const me = useCurrentUser();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCog className="size-4 text-accent" aria-hidden="true" />
          Signed in as
        </CardTitle>
        <CardDescription>Your account and roles</CardDescription>
      </CardHeader>
      <CardContent>
        {me.data ? (
          <dl className="grid gap-2 text-sm">
            <div>
              <dt className="sr-only">Name</dt>
              <dd className="font-medium">{me.data.name}</dd>
              <dt className="sr-only">Email</dt>
              <dd className="text-muted-foreground">{me.data.email}</dd>
            </div>
            <div>
              <dt className="mb-1 text-muted-foreground">Roles</dt>
              <dd className="flex flex-wrap gap-1">
                {me.data.roleNames.map((name, index) => (
                  <Badge key={me.data.roles[index] ?? name}>{name}</Badge>
                ))}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Last sign-in</dt>
              <dd className="tabular">
                {me.data.lastLoginAt ? formatDateTime(me.data.lastLoginAt) : 'First sign-in'}
              </dd>
            </div>
          </dl>
        ) : (
          <LoadingState />
        )}
      </CardContent>
    </Card>
  );
}
