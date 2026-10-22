import type { Metadata } from 'next';
import { DemoModeGate } from '@/components/demo-mode-gate';
import { InsurersView } from './insurers-view';

export const metadata: Metadata = { title: 'Insurers' };

export default function InsurersPage() {
  return (
    <DemoModeGate>
      <InsurersView />
    </DemoModeGate>
  );
}
