import type { Metadata } from 'next';
import { DemoModeGate } from '@/components/demo-mode-gate';
import { PageHeader } from '@/components/page-header';
import { ClaimsAnalysisPanel } from '@/components/reports/claims-analysis';

export const metadata: Metadata = { title: 'Claims analysis' };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Claims analysis"
        description="A policy’s TPA claims by status, member, age, claim type and disease, with the incurred claims ratio."
      />
      <DemoModeGate>
        <ClaimsAnalysisPanel />
      </DemoModeGate>
    </>
  );
}
