import type { Metadata } from 'next';
import { DemoModeGate } from '@/components/demo-mode-gate';
import { PageHeader } from '@/components/page-header';
import { TpaFormatsPanel } from '@/components/tpa/tpa-formats';

export const metadata: Metadata = { title: 'TPA formats' };

export default function Page() {
  return (
    <>
      <PageHeader
        title="TPA formats"
        description="Each TPA’s file layout, its statuses and the claims board column for each, and the emails imports may send."
      />
      <DemoModeGate>
        <TpaFormatsPanel />
      </DemoModeGate>
    </>
  );
}
