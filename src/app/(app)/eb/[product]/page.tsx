import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { productOfSlug } from '@/shared';
import { EbListView } from './eb-list-view';

export const metadata: Metadata = { title: 'Employee Benefits' };

export default async function EbProductPage({ params }: { params: Promise<{ product: string }> }) {
  const product = productOfSlug((await params).product);
  if (!product) notFound();
  return <EbListView product={product} />;
}
