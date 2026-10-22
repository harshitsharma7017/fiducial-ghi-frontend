import type { Metadata } from 'next';
import { DemoModeGate } from '@/components/demo-mode-gate';
import { ClientsView } from './clients-view';

export const metadata: Metadata = { title: 'Clients' };

export default function ClientsPage() {
  return (
    <DemoModeGate>
      <ClientsView />
    </DemoModeGate>
  );
}
