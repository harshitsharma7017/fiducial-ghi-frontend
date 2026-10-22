'use client';

import { ClaimLinksView } from '@/components/claims/claim-links';
import { DemoModeGate } from '@/components/demo-mode-gate';
import { PageHeader } from '@/components/page-header';

export function ClaimLinksPage() {
  return (
    <>
      <PageHeader
        title="Claim submission links"
        description="Secure, single-purpose links for employees to submit a claim and its documents without signing in."
      />
      <DemoModeGate>
        <ClaimLinksView />
      </DemoModeGate>
    </>
  );
}
