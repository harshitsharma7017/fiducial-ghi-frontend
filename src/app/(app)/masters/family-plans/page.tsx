import type { Metadata } from 'next';
import { DemoModeGate } from '@/components/demo-mode-gate';
import { FamilyPlansView } from './family-plans-view';

export const metadata: Metadata = { title: 'Family plans' };

export default function FamilyPlansPage() {
  return (
    <DemoModeGate>
      <FamilyPlansView />
    </DemoModeGate>
  );
}
