import type { Metadata } from 'next';
import { NewClaimView } from './new-claim-view';

export const metadata: Metadata = { title: 'New claim' };

export default function NewClaimPage() {
  return <NewClaimView />;
}
