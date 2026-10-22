'use client';

import { ClaimDetailView } from '@/components/claims/claim-detail';
import { DemoModeGate } from '@/components/demo-mode-gate';

export function ClaimView({ id }: { id: string }) {
  return (
    <DemoModeGate>
      <ClaimDetailView id={id} />
    </DemoModeGate>
  );
}
