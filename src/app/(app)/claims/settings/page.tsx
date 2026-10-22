import type { Metadata } from 'next';
import { ClaimSettingsPage } from './claim-settings-page';

export const metadata: Metadata = { title: 'Claim emails and HR' };

export default function SettingsPage() {
  return <ClaimSettingsPage />;
}
