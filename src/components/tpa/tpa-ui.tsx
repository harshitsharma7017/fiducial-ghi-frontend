'use client';

import { useQuery } from '@tanstack/react-query';
import type * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { insuredPoliciesQuery } from '@/lib/api/tpa';
import {
  EB_PRODUCT_LABELS,
  TPA_CLAIM_STATUS_LABELS,
  formatDate,
  type EbProduct,
  type InsuredPolicyView,
  type TpaClaimStatus,
} from '@/shared';

type Variant = React.ComponentProps<typeof Badge>['variant'];
const STATUS_VARIANT: Record<TpaClaimStatus, Variant> = {
  SETTLED: 'success',
  OUTSTANDING: 'warning',
  REJECTED: 'destructive',
  WITHDRAWN: 'muted',
};

export function TpaStatusBadge({ status, source }: { status: TpaClaimStatus; source?: string }) {
  return (
    <span className="grid gap-0.5">
      <Badge variant={STATUS_VARIANT[status]}>{TPA_CLAIM_STATUS_LABELS[status]}</Badge>
      {source ? <span className="text-xs text-muted-foreground">TPA: {source}</span> : null}
    </span>
  );
}

export const policyLabel = (policy: InsuredPolicyView) =>
  `${policy.clientName} · ${EB_PRODUCT_LABELS[policy.product]} · ${policy.policyNumber ?? policy.reference} (${formatDate(policy.policyStart)} to ${formatDate(policy.policyEnd)})`;

/** A placed policy (the claims of one policy year are imported and analysed together). */
export function PolicyPicker({
  value,
  onChange,
  product,
  label = 'Policy',
}: {
  value: string;
  onChange: (caseId: string, policy: InsuredPolicyView | null) => void;
  product?: EbProduct;
  label?: string;
}) {
  const policies = useQuery(insuredPoliciesQuery(product));
  const items = policies.data?.items ?? [];
  return (
    <Label className="grid gap-1 text-sm font-normal">
      {label}
      <NativeSelect
        className="w-[min(36rem,100%)]"
        value={value}
        disabled={policies.isPending}
        onChange={(event) =>
          onChange(
            event.target.value,
            items.find((item) => item.caseId === event.target.value) ?? null,
          )
        }
      >
        <option value="">
          {policies.isPending
            ? 'Loading policies…'
            : items.length === 0
              ? 'No placed policies'
              : 'Choose a placed policy'}
        </option>
        {items.map((policy) => (
          <option key={policy.caseId} value={policy.caseId}>
            {policyLabel(policy)}
          </option>
        ))}
      </NativeSelect>
    </Label>
  );
}

/** A labelled figure in a row of figures. */
export function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: 'success' | 'warning' | 'destructive';
}) {
  return (
    <div className="grid gap-0.5 rounded-md border px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={
          tone === 'success'
            ? 'tabular font-semibold text-success'
            : tone === 'warning'
              ? 'tabular font-semibold text-warning'
              : tone === 'destructive'
                ? 'tabular font-semibold text-destructive'
                : 'tabular font-semibold'
        }
      >
        {value}
      </span>
    </div>
  );
}
