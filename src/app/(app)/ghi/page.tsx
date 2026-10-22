import type { Metadata } from 'next';
import { GhiListView } from './ghi-list-view';

export const metadata: Metadata = { title: 'Group Health' };

export default function GhiPage() {
  return <GhiListView />;
}
