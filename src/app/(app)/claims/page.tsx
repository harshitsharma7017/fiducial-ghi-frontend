import type { Metadata } from 'next';
import { ClaimsView } from './claims-view';

export const metadata: Metadata = { title: 'Claims' };

export default async function ClaimsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { view } = await searchParams;
  return <ClaimsView initialView={view === 'table' ? 'table' : 'board'} />;
}
