'use client';

import { useQuery } from '@tanstack/react-query';
import { FileSpreadsheet } from 'lucide-react';
import { useState } from 'react';
import { DownloadButton } from '@/components/ghi/ghi-ui';
import { ErrorState, LoadingState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { familyPlansQuery, templatePath } from '@/lib/eb/api';
import { EB_PRODUCTS, EB_PRODUCT_LABELS, templateNameOf, type EbProduct } from '@/shared';
import { AwaitingConfirmationBadge, ProvisionalNotice } from './awaiting-confirmation';

/**
 * Downloads a provisional census template (Requirement 19.3): a product and an active plan of
 * it, or this case (its plan copy and Data Sheet basis). The provisional notice shows beside the
 * download, and an unconfirmed plan version says so (14.6, 19.5).
 */
export function TemplateDownloadDialog({
  product: caseProduct,
  caseId,
  casePlanId,
}: {
  product?: EbProduct;
  caseId?: string;
  casePlanId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [product, setProduct] = useState<EbProduct>(caseProduct ?? 'GMC');
  const [forCase, setForCase] = useState(Boolean(caseId));
  const [planId, setPlanId] = useState(casePlanId ?? '');
  const plans = useQuery({ ...familyPlansQuery(product), enabled: open });
  const active = (plans.data?.items ?? []).filter((plan) => plan.active && plan.current);
  const useCase = forCase && Boolean(caseId) && product === caseProduct;
  const chosen = active.find((plan) => plan.id === (useCase ? casePlanId : planId));
  const ready = useCase || Boolean(chosen);
  const path = templatePath(product, useCase ? { caseId } : { planId });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          <FileSpreadsheet aria-hidden="true" />
          Census template
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Download a census template</DialogTitle>
          <DialogDescription>
            The columns follow the product, the family plan and, for a case, its sum insured basis.
          </DialogDescription>
        </DialogHeader>
        <ProvisionalNotice />
        {caseId ? (
          <Label className="flex items-center gap-2 text-sm font-normal">
            <Checkbox
              checked={forCase}
              onCheckedChange={(checked) => setForCase(checked === true)}
            />
            For this case (its plan and Data Sheet)
          </Label>
        ) : null}
        {!useCase ? (
          <div className="grid gap-3">
            <Label className="grid gap-1 text-sm font-normal">
              Product
              <NativeSelect
                value={product}
                onChange={(event) => {
                  setProduct(event.target.value as EbProduct);
                  setPlanId('');
                }}
              >
                {EB_PRODUCTS.map((value) => (
                  <option key={value} value={value}>
                    {EB_PRODUCT_LABELS[value]}
                  </option>
                ))}
              </NativeSelect>
            </Label>
            {plans.isPending ? (
              <LoadingState label="Loading plans" />
            ) : plans.isError ? (
              <ErrorState error={plans.error} onRetry={() => void plans.refetch()} />
            ) : (
              <Label className="grid gap-1 text-sm font-normal">
                Family plan
                <NativeSelect value={planId} onChange={(event) => setPlanId(event.target.value)}>
                  <option value="">Choose the plan</option>
                  {active.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} · v{plan.current!.number}
                    </option>
                  ))}
                </NativeSelect>
              </Label>
            )}
          </div>
        ) : null}
        {chosen && !chosen.current?.clientConfirmed ? (
          <AwaitingConfirmationBadge openQuestions={chosen.openQuestions} />
        ) : null}
        <div>
          {ready ? (
            <DownloadButton
              path={path}
              fallbackName={`Provisional-${(chosen ? templateNameOf(chosen) : product).replace(/\s+/g, '-')}.xlsx`}
              variant="default"
            >
              Download template
            </DownloadButton>
          ) : (
            <Button type="button" disabled>
              Download template
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
