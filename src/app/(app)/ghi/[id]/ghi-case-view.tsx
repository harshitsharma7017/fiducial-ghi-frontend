'use client';

import { DemoModeGate } from '@/components/demo-mode-gate';
import { GhiWorkspace } from '@/components/ghi/ghi-workspace';

export function GhiCaseView({ id, tab }: { id: string; tab?: string }) {
  return (
    <DemoModeGate>
      <GhiWorkspace id={id} initialTab={tab} />
    </DemoModeGate>
  );
}
