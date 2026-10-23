'use client';

import { useState } from 'react';
import { NewGhiCaseForm } from '@/components/ghi/new-ghi-case-form';
import { AccessDeniedState } from '@/components/states';
import { useCurrentUser } from '@/hooks/use-current-user';
import { EB_PRODUCTS, casePermission, hasPermission, type EbProduct } from '@/shared';
import { ProductChoice } from './product-choice';

/**
 * New case (Requirement 1.2): the Employee Benefits product, then its form; no form (and so no
 * create request) until a product is chosen. Only the products the user may create
 * (gmc.create, gpa.create, gtli.create) are offered. Property cases start in Fiducial_frontend.
 */
export function NewCaseChooser({ initialProduct = null }: { initialProduct?: EbProduct | null }) {
  const me = useCurrentUser();
  const creatable = EB_PRODUCTS.filter((product) =>
    hasPermission(me.data?.permissions, casePermission(product, 'create')),
  );
  const [product, setProduct] = useState<EbProduct | null>(
    initialProduct && creatable.includes(initialProduct) ? initialProduct : null,
  );
  if (creatable.length === 0) {
    return <AccessDeniedState description="You may not create Employee Benefits cases." />;
  }
  return (
    <>
      <ProductChoice value={product} onChange={setProduct} products={creatable} />
      {product && creatable.includes(product) ? (
        <NewGhiCaseForm key={product} product={product} />
      ) : null}
    </>
  );
}
