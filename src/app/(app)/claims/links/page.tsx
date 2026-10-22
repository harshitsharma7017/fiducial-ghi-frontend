import type { Metadata } from 'next';
import { ClaimLinksPage } from './claim-links-page';

export const metadata: Metadata = { title: 'Claim submission links' };

export default function LinksPage() {
  return <ClaimLinksPage />;
}
