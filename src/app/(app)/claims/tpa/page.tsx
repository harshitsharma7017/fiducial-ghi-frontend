import type { Metadata } from 'next';
import { TpaClaimsPage } from './tpa-claims-page';

export const metadata: Metadata = { title: 'TPA claims' };

export default function Page() {
  return <TpaClaimsPage />;
}
