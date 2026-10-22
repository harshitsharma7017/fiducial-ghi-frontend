'use client';

import { useQuery } from '@tanstack/react-query';
import { Activity, CircleCheck, TriangleAlert } from 'lucide-react';
import { ErrorState, LoadingState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError, apiFetch } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { HealthResponseSchema, formatDateTime } from '@/shared';

/** API and database health, refreshed every minute. */
export function SystemStatusCard() {
  const health = useQuery({
    queryKey: queryKeys.health,
    queryFn: ({ signal }) => apiFetch('health', { schema: HealthResponseSchema, signal }),
    refetchInterval: 60_000,
  });
  const databaseDown = health.error instanceof ApiError && health.error.status === 503;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="size-4 text-accent" aria-hidden="true" />
          System status
        </CardTitle>
        <CardDescription>API and database health</CardDescription>
      </CardHeader>
      <CardContent>
        {health.isPending ? (
          <LoadingState label="Checking system status…" />
        ) : databaseDown ? (
          <p className="flex items-center gap-2 text-sm text-destructive">
            <TriangleAlert className="size-4" aria-hidden="true" />
            The API is up but cannot reach the database.
          </p>
        ) : health.isError ? (
          <ErrorState
            error={health.error}
            onRetry={() => void health.refetch()}
            title="Status unavailable"
          />
        ) : (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">API</dt>
            <dd>
              <Badge variant="success">
                <CircleCheck aria-hidden="true" className="size-3" />
                Up · v{health.data.version}
              </Badge>
            </dd>
            <dt className="text-muted-foreground">Database</dt>
            <dd>
              <Badge variant={health.data.db === 'up' ? 'success' : 'destructive'}>
                {health.data.db === 'up' ? 'Connected' : 'Down'}
              </Badge>
            </dd>
            <dt className="text-muted-foreground">Checked</dt>
            <dd className="tabular">{formatDateTime(health.data.time)}</dd>
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
