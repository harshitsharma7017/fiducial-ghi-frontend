'use client';

import { FileUp, Settings2 } from 'lucide-react';
import Link from 'next/link';
import { DemoModeGate } from '@/components/demo-mode-gate';
import { PageHeader } from '@/components/page-header';
import { TpaClaimsPanel } from '@/components/tpa/tpa-claims';
import { Button } from '@/components/ui/button';
import { usePermission } from '@/hooks/use-permission';

export function TpaClaimsPage() {
  const canProcess = usePermission('claims.process');
  const canAdmin = usePermission('claims.admin');
  return (
    <>
      <PageHeader
        title="TPA claims"
        description="Claims imported from TPA files, by policy. Diagnosis details are shown only to staff who process claims."
        actions={
          <>
            {canAdmin ? (
              <Button asChild variant="outline">
                <Link href="/claims/tpa/formats">
                  <Settings2 aria-hidden="true" />
                  TPA formats
                </Link>
              </Button>
            ) : null}
            {canProcess ? (
              <Button asChild>
                <Link href="/claims/tpa/import">
                  <FileUp aria-hidden="true" />
                  Import a TPA file
                </Link>
              </Button>
            ) : null}
          </>
        }
      />
      <DemoModeGate>
        <TpaClaimsPanel />
      </DemoModeGate>
    </>
  );
}
