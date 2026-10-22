import type { Metadata } from 'next';
import { DemoModeGate } from '@/components/demo-mode-gate';
import { AgeBandsView } from './age-bands-view';

export const metadata: Metadata = { title: 'Age bands' };

export default function AgeBandsPage() {
  return (
    <DemoModeGate>
      <AgeBandsView />
    </DemoModeGate>
  );
}
