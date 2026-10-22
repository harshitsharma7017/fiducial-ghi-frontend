'use client';

import { ClaimSettings } from '@/components/claims/claim-settings';
import { DemoModeGate } from '@/components/demo-mode-gate';
import { PageHeader } from '@/components/page-header';

export function ClaimSettingsPage() {
  return (
    <>
      <PageHeader
        title="Claim emails and HR"
        description="The emails sent at each claim move, and each company’s HR contact."
      />
      <DemoModeGate>
        <ClaimSettings />
      </DemoModeGate>
    </>
  );
}
