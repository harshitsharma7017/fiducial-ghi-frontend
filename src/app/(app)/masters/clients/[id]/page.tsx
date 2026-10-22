import type { Metadata } from 'next';
import { DemoModeGate } from '@/components/demo-mode-gate';
import { ClientDetailView } from './client-detail-view';

export const metadata: Metadata = { title: 'Client' };

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <DemoModeGate>
      <ClientDetailView id={id} />
    </DemoModeGate>
  );
}
