import type { Metadata } from 'next';
import { DemoModeGate } from '@/components/demo-mode-gate';
import { EmailTemplatesView } from './email-templates-view';

export const metadata: Metadata = { title: 'Email templates' };

export default function Page() {
  return (
    <DemoModeGate>
      <EmailTemplatesView />
    </DemoModeGate>
  );
}
