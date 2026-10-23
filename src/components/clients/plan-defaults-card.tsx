'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ErrorState, LoadingState, errorMessage } from '@/components/states';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/native-select';
import { usePermission } from '@/hooks/use-permission';
import { apiFetch } from '@/lib/api-client';
import { AnyRecordSchema } from '@/lib/api/ghi';
import { ebKeys, familyPlansQuery, planDefaultsQuery } from '@/lib/eb/api';
import { EB_PRODUCT_LABELS, formatDateTime, type EbProduct } from '@/shared';

/**
 * The company's default family plan per product (Requirement 15.1): a new case of that product
 * starts with it. Shown to clients.view; changing it needs clients.manage. No plan is set unless
 * a user sets one.
 */
export function PlanDefaultsCard({ clientId }: { clientId: string }) {
  const canManage = usePermission('clients.update');
  const defaults = useQuery(planDefaultsQuery(clientId));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Default family plans</CardTitle>
        <CardDescription>
          A new GMC, GPA or GTLI case for this company starts with its product’s default plan. A
          case can still be given another plan.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        {defaults.isPending ? (
          <LoadingState label="Loading the default plans" />
        ) : defaults.isError ? (
          <ErrorState error={defaults.error} onRetry={() => void defaults.refetch()} />
        ) : (
          defaults.data.items.map((item) => (
            <DefaultRow key={item.product} clientId={clientId} item={item} canManage={canManage} />
          ))
        )}
      </CardContent>
    </Card>
  );
}

function DefaultRow({
  clientId,
  item,
  canManage,
}: {
  clientId: string;
  item: {
    product: EbProduct;
    planId: string | null;
    name: string | null;
    code: string | null;
    active: boolean | null;
    setAt: string | null;
    setBy: string | null;
  };
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [planId, setPlanId] = useState(item.planId ?? '');
  const plans = useQuery({ ...familyPlansQuery(item.product), enabled: editing });
  const save = useMutation({
    mutationFn: () =>
      apiFetch(`eb/companies/${clientId}/plan-defaults/${item.product}`, {
        method: 'PUT',
        body: { planId: planId === '' ? null : planId },
        schema: AnyRecordSchema,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ebKeys.company(clientId) });
      setEditing(false);
    },
  });
  return (
    <div className="grid gap-2 rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="grid gap-0.5">
          <span className="font-medium">{EB_PRODUCT_LABELS[item.product]}</span>
          <span className="text-muted-foreground">
            {item.planId ? `${item.name ?? ''} (${item.code ?? ''})` : 'No default plan'}
            {item.setAt ? ` · set by ${item.setBy ?? ''} on ${formatDateTime(item.setAt)}` : ''}
          </span>
          {item.planId && item.active === false ? (
            <Badge variant="warning">The plan is inactive</Badge>
          ) : null}
        </div>
        {canManage && !editing ? (
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
            Change
          </Button>
        ) : null}
      </div>
      {editing ? (
        <form
          noValidate
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <NativeSelect
            aria-label={`${EB_PRODUCT_LABELS[item.product]} default plan`}
            value={planId}
            onChange={(event) => setPlanId(event.target.value)}
            disabled={plans.isPending}
          >
            <option value="">No default plan</option>
            {(plans.data?.items ?? [])
              .filter((plan) => plan.active || plan.id === item.planId)
              .map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} ({plan.code})
                </option>
              ))}
          </NativeSelect>
          <Button type="submit" size="sm" disabled={save.isPending}>
            Save
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </form>
      ) : null}
      {plans.isError ? (
        <ErrorState error={plans.error} onRetry={() => void plans.refetch()} />
      ) : null}
      {save.isError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{errorMessage(save.error)}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
