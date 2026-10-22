import type { Metadata } from 'next';
import { DemoModeGate } from '@/components/demo-mode-gate';
import { AuditView } from './audit-view';

export const metadata: Metadata = { title: 'Audit log' };

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(resolved)) {
    if (typeof value === 'string') query.set(key, value);
  }
  const serverSearch = query.toString();
  // The log is live API data, so mock mode shows the demo-mode state instead.
  return (
    <DemoModeGate>
      <AuditView serverSearch={serverSearch ? `?${serverSearch}` : ''} />
    </DemoModeGate>
  );
}
