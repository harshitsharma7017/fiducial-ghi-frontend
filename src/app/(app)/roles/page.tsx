import type { Metadata } from 'next';
import { DemoModeGate } from '@/components/demo-mode-gate';
import { RolesView } from './roles-view';

export const metadata: Metadata = { title: 'Roles' };

export default function RolesPage() {
  return (
    <DemoModeGate>
      <RolesView />
    </DemoModeGate>
  );
}
