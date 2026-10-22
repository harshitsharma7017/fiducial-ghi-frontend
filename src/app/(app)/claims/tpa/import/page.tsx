import type { Metadata } from 'next';
import { DemoModeGate } from '@/components/demo-mode-gate';
import { PageHeader } from '@/components/page-header';
import { TpaImportPanel } from '@/components/tpa/tpa-import';

export const metadata: Metadata = { title: 'Import a TPA file' };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Import a TPA file"
        description="Check a TPA’s claims export against its format, review the problems, then import."
      />
      <DemoModeGate>
        <TpaImportPanel />
      </DemoModeGate>
    </>
  );
}
