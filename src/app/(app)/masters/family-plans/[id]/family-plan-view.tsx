'use client';

import { useQuery } from '@tanstack/react-query';
import { LoaderCircle, Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { AwaitingNote } from '@/components/eb/awaiting-confirmation';
import { versionServerErrors } from '@/components/family-plans/family-plan-form-sheet';
import { VersionCard, usePlanChange } from '@/components/family-plans/version-card';
import {
  VersionEditor,
  bodyOf,
  draftErrors,
  draftOf,
  emptyDraft,
  type VersionDraft,
} from '@/components/family-plans/version-editor';
import { PageHeader } from '@/components/page-header';
import { EmptyState, ErrorState, LoadingState, errorMessage } from '@/components/states';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { todayIst } from '@/lib/dates';
import { familyPlanOpenCasesQuery, familyPlanQuery } from '@/lib/eb/api';
import {
  EB_PRODUCT_LABELS,
  FamilyPlanSchema,
  awaitingText,
  ebCasePath,
  type FamilyPlan,
} from '@/shared';

/** A family plan with every version (Requirement 12); changes need masters.manage (24.1). */
export function FamilyPlanView({ id }: { id: string }) {
  const plan = useQuery(familyPlanQuery(id));
  const canManage = usePermission('family_plans.manage');
  if (plan.isPending) return <LoadingState label="Loading the plan" />;
  if (plan.isError) {
    if (plan.error instanceof ApiError && plan.error.status === 404)
      return (
        <EmptyState
          title="Plan not found"
          description={<Link href="/masters/family-plans">Back to family plans</Link>}
        />
      );
    return <ErrorState error={plan.error} onRetry={() => void plan.refetch()} />;
  }
  const data = plan.data;
  const versions = [...data.versions].sort((a, b) => b.number - a.number);
  return (
    <>
      <PageHeader
        title={`${data.name} (${data.code})`}
        description={`${EB_PRODUCT_LABELS[data.product]} family plan${data.isDefault ? ' · a default plan' : ''}`}
        actions={canManage ? <PlanActiveToggle plan={data} /> : undefined}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {data.active ? (
          <Badge variant="success">Active</Badge>
        ) : (
          <Badge variant="muted">Inactive</Badge>
        )}
        {data.inEffect ? (
          <Badge variant="info">Version {data.inEffect} in effect today</Badge>
        ) : (
          <Badge variant="warning">No version in effect today</Badge>
        )}
      </div>
      {data.isDefault && data.openQuestions.length > 0 ? (
        <div className="mb-4">
          <AwaitingNote>
            This default plan follows the rules given so far;{' '}
            {awaitingText(data.openQuestions).toLowerCase()}.
          </AwaitingNote>
        </div>
      ) : null}
      <div className="grid gap-4">
        {canManage ? <NewVersion plan={data} /> : null}
        {versions.map((version) => (
          <VersionCard
            key={`${version.number}-${data.updatedAt}`}
            plan={data}
            version={version}
            canManage={canManage}
          />
        ))}
      </div>
    </>
  );
}

/** A new Draft version, started from the latest version's rules (12.2). */
function NewVersion({ plan }: { plan: FamilyPlan }) {
  const [draft, setDraft] = useState<VersionDraft | null>(null);
  const create = usePlanChange(plan.id, (body: unknown) =>
    apiFetch(`family-plans/${plan.id}/versions`, {
      method: 'POST',
      body,
      schema: FamilyPlanSchema,
    }),
  );
  if (!draft) {
    const latest = plan.versions.at(-1);
    return (
      <div>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            setDraft(
              latest
                ? { ...draftOf(latest), effectiveFrom: todayIst(), effectiveTo: '' }
                : emptyDraft(todayIst()),
            )
          }
        >
          <Plus aria-hidden="true" />
          New version
        </Button>
      </div>
    );
  }
  const invalid = Object.keys(draftErrors(draft)).length > 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle>New version (Draft)</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          noValidate
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!invalid) create.mutate(bodyOf(draft), { onSuccess: () => setDraft(null) });
          }}
        >
          <VersionEditor
            value={draft}
            onChange={setDraft}
            serverErrors={versionServerErrors(create.error)}
          />
          {create.isError ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{errorMessage(create.error)}</AlertDescription>
            </Alert>
          ) : null}
          <div className="flex gap-2">
            <Button type="submit" disabled={create.isPending || invalid}>
              {create.isPending ? (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              ) : null}
              Save the draft
            </Button>
            <Button type="button" variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/**
 * Activates or deactivates the plan. Deactivating lists the open cases that use it first; they
 * keep their copy of the version (12.8).
 */
function PlanActiveToggle({ plan }: { plan: FamilyPlan }) {
  const [open, setOpen] = useState(false);
  const cases = useQuery(familyPlanOpenCasesQuery(plan.id, open));
  const change = usePlanChange(plan.id, (active: boolean) =>
    apiFetch(`family-plans/${plan.id}/${active ? 'activate' : 'deactivate'}`, {
      method: 'POST',
      schema: FamilyPlanSchema,
    }),
  );
  if (!plan.active)
    return (
      <Button
        type="button"
        variant="outline"
        disabled={change.isPending}
        onClick={() => change.mutate(true)}
      >
        Activate the plan
      </Button>
    );
  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        Deactivate the plan
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate {plan.name}?</DialogTitle>
            <DialogDescription>
              New cases cannot be given this plan. Cases that use it keep their copy of the version.
            </DialogDescription>
          </DialogHeader>
          {cases.isPending ? (
            <LoadingState label="Checking the open cases" />
          ) : cases.isError ? (
            <ErrorState error={cases.error} onRetry={() => void cases.refetch()} />
          ) : cases.data.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No open case uses this plan.</p>
          ) : (
            <div className="grid gap-1 text-sm">
              <p>Open cases that use it:</p>
              <ul className="grid max-h-48 gap-1 overflow-y-auto">
                {cases.data.items.map((item) => (
                  <li key={item.id}>
                    <Link
                      className="text-accent-strong hover:underline"
                      href={ebCasePath(item.product, item.id)}
                    >
                      {item.reference}
                    </Link>{' '}
                    · {item.clientName} · v{item.versionNumber}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {change.isError ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{errorMessage(change.error)}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={change.isPending || cases.isPending}
              onClick={() => change.mutate(false, { onSuccess: () => setOpen(false) })}
            >
              {change.isPending ? (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              ) : null}
              Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
