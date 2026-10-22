'use client';

import { DemoModeGate } from '@/components/demo-mode-gate';
import { EbWorkspace } from '@/components/eb/eb-workspace';
import type { EbRoutedProduct } from '@/shared';

export function EbCaseView({
  product,
  id,
  tab,
}: {
  product: EbRoutedProduct;
  id: string;
  tab?: string;
}) {
  return (
    <DemoModeGate>
      <EbWorkspace product={product} id={id} initialTab={tab} />
    </DemoModeGate>
  );
}
