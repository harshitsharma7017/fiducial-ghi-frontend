import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { productOfSlug } from '@/shared';
import { EbCaseView } from './eb-case-view';

export const metadata: Metadata = { title: 'Employee benefits case' };

export default async function EbCasePage({
  params,
  searchParams,
}: {
  params: Promise<{ product: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ product: slug, id }, { tab }] = await Promise.all([params, searchParams]);
  const product = productOfSlug(slug);
  if (!product) notFound();
  return <EbCaseView product={product} id={id} tab={typeof tab === 'string' ? tab : undefined} />;
}
