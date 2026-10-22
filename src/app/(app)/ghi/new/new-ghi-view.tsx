'use client';

import { DemoModeGate } from '@/components/demo-mode-gate';
import { NewCaseChooser } from '@/components/eb/new-case-chooser';
import { PageHeader } from '@/components/page-header';
import type { EbProduct } from '@/shared';

/** /ghi/new: the new case form, GMC chosen unless ?product= names another (Requirement 2.2). */
export function NewGhiView({ initialProduct }: { initialProduct: EbProduct }) {
  return (
    <>
      <PageHeader
        title="New case"
        description="Employee Benefits: choose the product, the company, the policy period and who works on it. Then fill the Data Sheet and the employee census."
      />
      <DemoModeGate>
        <NewCaseChooser initialProduct={initialProduct} />
      </DemoModeGate>
    </>
  );
}
