import type { Metadata } from 'next';
import { DemoModeGate } from '@/components/demo-mode-gate';
import { UsersView } from './users-view';

export const metadata: Metadata = { title: 'Users' };

export default function UsersPage() {
  return (
    <DemoModeGate>
      <UsersView />
    </DemoModeGate>
  );
}
