import type { Metadata } from 'next';
import { DemoModeGate } from '@/components/demo-mode-gate';
import { PageHeader } from '@/components/page-header';
import { RenewalAnalysisPanel } from '@/components/reports/renewal-analysis';

export const metadata: Metadata = { title: 'Renewal analysis' };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Renewal analysis"
        description="Benefit and cost of up to three policy years, side by side, with the coming year’s quotes."
      />
      <DemoModeGate>
        <RenewalAnalysisPanel />
      </DemoModeGate>
    </>
  );
}
