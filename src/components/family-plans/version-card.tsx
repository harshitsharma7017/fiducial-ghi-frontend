'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { AwaitingConfirmationBadge } from '@/components/eb/awaiting-confirmation';
import { Field } from '@/components/eb/eb-ui';
import { errorMessage } from '@/components/states';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/api-client';
import { ebKeys } from '@/lib/eb/api';
import {
  FamilyPlanSchema,
  PLAN_VERSION_STATUS_LABELS,
  formatDate,
  formatDateTime,
  mixingText,
  slotText,
  type FamilyPlan,
  type FamilyPlanVersion,
} from '@/shared';
import { versionServerErrors } from './family-plan-form-sheet';
import { VersionEditor, bodyOf, draftErrors, draftOf } from './version-editor';

/** A change to a plan; on success every plan query is refreshed. */
export function usePlanChange<T>(planId: string, send: (input: T) => Promise<FamilyPlan>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: send,
    onSuccess: (plan) => {
      queryClient.setQueryData([...ebKeys.plans, planId], plan);
      void queryClient.invalidateQueries({ queryKey: ebKeys.plans });
    },
  });
}

/**
 * One version of a plan (Requirements 12.2 to 12.7): its dates, status, slots and mixing rule.
 * A Draft can be edited and activated; an Active version is locked except for setting its end
 * date once and recording the client's confirmation.
 */
export function VersionCard({
  plan,
  version,
  canManage,
}: {
  plan: FamilyPlan;
  version: FamilyPlanVersion;
  canManage: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => draftOf(version));
  const [endDate, setEndDate] = useState('');
  const base = `family-plans/${plan.id}/versions/${version.number}`;
  const save = usePlanChange(plan.id, () =>
    apiFetch(base, { method: 'PUT', body: bodyOf(draft), schema: FamilyPlanSchema }),
  );
  const action = usePlanChange(
    plan.id,
    (input: { path: string; method: 'POST' | 'PUT'; body?: unknown }) =>
      apiFetch(`${base}/${input.path}`, {
        method: input.method,
        body: input.body,
        schema: FamilyPlanSchema,
      }),
  );
  const draftInvalid = Object.keys(draftErrors(draft)).length > 0;
  const inEffect = plan.inEffect === version.number;
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <CardTitle className="flex flex-wrap items-center gap-2">
            Version {version.number}
            <Badge variant={version.status === 'ACTIVE' ? 'success' : 'muted'}>
              {PLAN_VERSION_STATUS_LABELS[version.status]}
            </Badge>
            {inEffect ? <Badge variant="info">In effect today</Badge> : null}
            {version.clientConfirmed ? (
              <Badge variant="success">Confirmed by the client</Badge>
            ) : (
              <AwaitingConfirmationBadge openQuestions={plan.openQuestions} />
            )}
          </CardTitle>
          <CardDescription>
            From {formatDate(version.effectiveFrom)}
            {version.effectiveTo ? ` to ${formatDate(version.effectiveTo)}` : ', no end date'}
            {version.activatedAt
              ? ` · activated by ${version.activatedBy ?? ''} on ${formatDateTime(version.activatedAt)}`
              : ` · created by ${version.createdBy} on ${formatDateTime(version.createdAt)}`}
          </CardDescription>
        </div>
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            {version.status === 'DRAFT' && !editing ? (
              <>
                <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
                  Edit
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={action.isPending}
                  onClick={() => action.mutate({ path: 'activate', method: 'POST' })}
                >
                  Activate
                </Button>
              </>
            ) : null}
            {version.status === 'ACTIVE' && !version.clientConfirmed ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={action.isPending}
                onClick={() => action.mutate({ path: 'confirm', method: 'POST' })}
              >
                Record the client’s confirmation
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        {editing ? (
          <form
            noValidate
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!draftInvalid) save.mutate(undefined, { onSuccess: () => setEditing(false) });
            }}
          >
            <VersionEditor
              value={draft}
              onChange={setDraft}
              serverErrors={versionServerErrors(save.error)}
            />
            {save.isError ? (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{errorMessage(save.error)}</AlertDescription>
              </Alert>
            ) : null}
            <div className="flex gap-2">
              <Button type="submit" disabled={save.isPending || draftInvalid}>
                {save.isPending ? (
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                ) : null}
                Save the draft
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDraft(draftOf(version));
                  setEditing(false);
                  save.reset();
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <>
            <ul className="grid gap-1" aria-label={`Slots of version ${version.number}`}>
              {version.slots.map((slot) => (
                <li key={slot.name}>{slotText(slot)}</li>
              ))}
            </ul>
            <p className="text-muted-foreground">
              Parents and parents-in-law: {mixingText(version)}
            </p>
          </>
        )}
        {canManage && version.status === 'ACTIVE' && !version.effectiveTo ? (
          <form
            noValidate
            className="flex flex-wrap items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (endDate)
                action.mutate({
                  path: 'effective-to',
                  method: 'PUT',
                  body: { effectiveTo: endDate },
                });
            }}
          >
            <Field label="End date (can be set once)">
              <Input
                type="date"
                min={version.effectiveFrom}
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </Field>
            <Button type="submit" variant="outline" disabled={!endDate || action.isPending}>
              Set the end date
            </Button>
          </form>
        ) : null}
        {action.isError ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{errorMessage(action.error)}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
