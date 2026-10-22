import type { Metadata } from 'next';
import { isEbProduct } from '@/shared';
import { NewGhiView } from './new-ghi-view';

export const metadata: Metadata = { title: 'New Employee Benefits case' };

/** ?product=GPA or GTLI preselects that product (the lists' New case); GMC otherwise. */
export default async function NewGhiPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { product } = await searchParams;
  return <NewGhiView initialProduct={isEbProduct(product) ? product : 'GMC'} />;
}
