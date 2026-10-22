'use client';

import { useQuery } from '@tanstack/react-query';
import { CircleAlert, LoaderCircle, UsersRound } from 'lucide-react';
import { useState } from 'react';
import { ErrorState, LoadingState, errorMessage } from '@/components/states';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { usePermission } from '@/hooks/use-permission';
import { ApiError, apiFetch } from '@/lib/api-client';
import { AnyRecordSchema, caseApi, useGhiMutation } from '@/lib/api/ghi';
import { familyPlansQuery } from '@/lib/eb/api';
import {
  PLAN_ASSIGNMENT_SOURCE_LABELS,
  formatDate,
  mixingText,
  slotText,
  type EbPlanAssignment,
  type EbProduct,
} from '@/shared';
import { AwaitingConfirmationBadge } from './awaiting-confirmation';

/**
 * The family plan a case uses (Requirement 15): its name, version and slots, whether the client
 * has confirmed it, and the action to assign or change it while the case is unlocked.
 */
export function PlanCard({
  caseId,
  product,
  plan,
  editable,
}: {
  caseId: string;
  product: EbProduct;
  plan: EbPlanAssignment | null;
  /** The case is open, unlocked and not placed. */
  editable: boolean;
}) {
  const canEdit = usePermission('proposals.edit');
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <CardTitle className="flex items-center gap-2">
            <UsersRound aria-hidden="true" className="size-4 text-primary" />
            Family plan
          </CardTitle>
          <CardDescription>
            Who a family may include. The case keeps a copy of the version assigned.
          </CardDescription>
        </div>
        {canEdit && editable ? (
          <Button type="button" variant="outline" onClick={() => setOpen(true)}>
            {plan ? 'Change plan' : 'Assign a plan'}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        {plan ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">
                {plan.name} · v{plan.versionNumber}
              </span>
              {plan.clientConfirmed ? null : (
                <AwaitingConfirmationBadge openQuestions={plan.openQuestions} />
              )}
            </div>
            <ul className="grid gap-1" aria-label="Slots">
              {plan.slots.map((slot) => (
                <li key={slot.name}>{slotText(slot)}</li>
              ))}
            </ul>
            <p className="text-muted-foreground">Parents and parents-in-law: {mixingText(plan)}</p>
            <p className="text-xs text-muted-foreground">
              {PLAN_ASSIGNMENT_SOURCE_LABELS[plan.source]} · assigned by {plan.assignedBy},{' '}
              {formatDate(plan.assignedAt.slice(0, 10))}
            </p>
          </>
        ) : (
          <Alert variant="warning">
            <CircleAlert aria-hidden="true" />
            <AlertTitle>
              {product === 'GMC'
                ? 'No plan: the Data Sheet’s family definition applies'
                : 'Plan needed before the RFQ'}
            </AlertTitle>
            <AlertDescription>
              {product === 'GMC'
                ? 'A plan is optional on GMC cases (open question 5).'
                : 'Assign a family plan; the census is checked against it.'}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
      {open ? (
        <AssignPlanDialog
          caseId={caseId}
          product={product}
          current={plan}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </Card>
  );
}

interface ConflictFamily {
  employeeId: string;
  rules: string[];
}

function conflictFamilies(error: unknown): ConflictFamily[] {
  if (!(error instanceof ApiError) || error.code !== 'EB_PLAN_CONFLICT') return [];
  const details = error.details as { families?: ConflictFamily[] } | undefined;
  return details?.families ?? [];
}

export function AssignPlanDialog({
  caseId,
  product,
  current,
  onClose,
}: {
  caseId: string;
  product: EbProduct;
  current: EbPlanAssignment | null;
  onClose: () => void;
}) {
  const plans = useQuery(familyPlansQuery(product));
  const [planId, setPlanId] = useState(current?.planId ?? '');
  const assign = useGhiMutation(
    caseId,
    () =>
      apiFetch(`${caseApi(product, caseId)}/plan`, {
        method: 'PUT',
        body: { planId },
        schema: AnyRecordSchema,
      }),
    () => ({ title: 'Family plan assigned' }),
  );
  const families = conflictFamilies(assign.error);
  const choices = (plans.data?.items ?? []).filter((plan) => plan.active && plan.current);
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{current ? 'Change the family plan' : 'Assign a family plan'}</DialogTitle>
          <DialogDescription>
            Active {product} plans, in the version in effect on the case’s policy start. Every
            family already in the census is checked against the plan.
          </DialogDescription>
        </DialogHeader>
        {plans.isPending ? (
          <LoadingState label="Loading plans" />
        ) : plans.isError ? (
          <ErrorState error={plans.error} onRetry={() => void plans.refetch()} />
        ) : choices.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active {product} plan.</p>
        ) : (
          <fieldset className="grid gap-2">
            <legend className="sr-only">Plan</legend>
            {choices.map((plan) => (
              <label
                key={plan.id}
                className="flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2"
              >
                <input
                  type="radio"
                  name="plan"
                  value={plan.id}
                  checked={planId === plan.id}
                  onChange={() => setPlanId(plan.id)}
                  className="mt-1 accent-[var(--primary)]"
                />
                <span className="grid gap-1 text-sm">
                  <span className="font-medium">
                    {plan.name} · v{plan.current!.number}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {plan.current!.slots.map((slot) => slotText(slot)).join('; ')}
                  </span>
                  {plan.current!.clientConfirmed ? null : (
                    <AwaitingConfirmationBadge openQuestions={plan.openQuestions} />
                  )}
                </span>
              </label>
            ))}
          </fieldset>
        )}
        {families.length > 0 ? (
          <Alert variant="destructive" role="alert">
            <AlertTitle>{errorMessage(assign.error)}</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-4">
                {families.map((family) => (
                  <li key={family.employeeId}>
                    Employee {family.employeeId}: {family.rules.join('; ')}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : assign.isError ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{errorMessage(assign.error)}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!planId || assign.isPending}
            onClick={() => assign.mutate(undefined, { onSuccess: onClose })}
          >
            {assign.isPending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
