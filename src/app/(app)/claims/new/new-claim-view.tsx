'use client';

import { NewClaimForm } from '@/components/claims/new-claim-form';
import { DemoModeGate } from '@/components/demo-mode-gate';
import { PageHeader } from '@/components/page-header';
import { AccessDeniedState } from '@/components/states';
import { usePermission } from '@/hooks/use-permission';

export function NewClaimView() {
  const canProcess = usePermission('claims.process');
  return (
    <>
      <PageHeader
        title="New claim"
        description="A group health claim for an employee or a covered family member. It starts in the Form column, assigned to you."
      />
      <DemoModeGate>
        {canProcess ? (
          <NewClaimForm />
        ) : (
          <AccessDeniedState description="Claims staff and Admins create claims." />
        )}
      </DemoModeGate>
    </>
  );
}
