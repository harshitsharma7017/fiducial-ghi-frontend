import type { Metadata } from 'next';
import { GhiCaseView } from './ghi-case-view';

export const metadata: Metadata = { title: 'Group health case' };

export default async function GhiCasePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);
  return <GhiCaseView id={id} tab={typeof tab === 'string' ? tab : undefined} />;
}
