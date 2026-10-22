'use client';

import { useState } from 'react';
import { NewGhiCaseForm } from '@/components/ghi/new-ghi-case-form';
import { AccessDeniedState } from '@/components/states';
import { usePermission } from '@/hooks/use-permission';
import type { EbProduct } from '@/shared';
import { ProductChoice } from './product-choice';

/**
 * New case (Requirement 1.2): the Employee Benefits product, then its form; no form (and so no
 * create request) until a product is chosen. Property cases start in Fiducial_frontend.
 */
export function NewCaseChooser({ initialProduct = null }: { initialProduct?: EbProduct | null }) {
  const canCreate = usePermission('proposals.create');
  const [product, setProduct] = useState<EbProduct | null>(initialProduct);
  if (!canCreate) {
    return <AccessDeniedState description="A Relationship Manager or Admin starts cases." />;
  }
  return (
    <>
      <ProductChoice value={product} onChange={setProduct} />
      {product ? <NewGhiCaseForm key={product} product={product} /> : null}
    </>
  );
}
