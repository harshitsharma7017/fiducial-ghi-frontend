'use client';

import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { AwaitingConfirmationBadge } from '@/components/eb/awaiting-confirmation';
import { FamilyPlanFormSheet } from '@/components/family-plans/family-plan-form-sheet';
import { PageHeader } from '@/components/page-header';
import { EmptyState, ErrorState, TableLoadingRows } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { usePermission } from '@/hooks/use-permission';
import { familyPlansQuery } from '@/lib/eb/api';
import { EB_PRODUCTS, EB_PRODUCT_LABELS, formatDate, type EbProduct } from '@/shared';

const COLUMNS = 5;

/**
 * The Family Plan Master (Requirement 12): the plans of one product, with the version in effect
 * today and whether the client has confirmed it. Changes need masters.manage.
 */
export function FamilyPlansView() {
  const [product, setProduct] = useState<EbProduct>('GMC');
  const canManage = usePermission('family_plans.manage');
  const plans = useQuery(familyPlansQuery(product));
  const items = plans.data?.items ?? [];

  const newButton = (
    <Button>
      <Plus aria-hidden="true" />
      New plan
    </Button>
  );

  let body;
  if (plans.isPending) body = <TableLoadingRows columns={COLUMNS} />;
  else if (plans.isError) {
    body = (
      <TableRow>
        <TableCell colSpan={COLUMNS} className="p-4">
          <ErrorState error={plans.error} onRetry={() => void plans.refetch()} />
        </TableCell>
      </TableRow>
    );
  } else if (items.length === 0) {
    body = (
      <TableRow>
        <TableCell colSpan={COLUMNS}>
          <EmptyState
            title={`No ${EB_PRODUCT_LABELS[product]} plans`}
            description={canManage ? 'Add a plan to assign it to cases.' : 'An Admin adds plans.'}
          />
        </TableCell>
      </TableRow>
    );
  } else {
    body = items.map((plan) => (
      <TableRow key={plan.id}>
        <TableCell className="tabular whitespace-nowrap">{plan.code}</TableCell>
        <TableCell className="font-medium">
          <Link
            href={`/masters/family-plans/${plan.id}`}
            className="rounded-sm text-accent-strong underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            {plan.name}
          </Link>
          {plan.isDefault ? (
            <Badge variant="muted" className="ml-2">
              Default
            </Badge>
          ) : null}
        </TableCell>
        <TableCell>
          {plan.active ? (
            <Badge variant="success">Active</Badge>
          ) : (
            <Badge variant="muted">Inactive</Badge>
          )}
        </TableCell>
        <TableCell>
          {plan.current ? (
            <span className="tabular">
              v{plan.current.number} · from {formatDate(plan.current.effectiveFrom)}
              {plan.current.effectiveTo ? ` to ${formatDate(plan.current.effectiveTo)}` : ''}
            </span>
          ) : (
            <span className="text-muted-foreground">None in effect</span>
          )}
        </TableCell>
        <TableCell>
          {plan.current && !plan.current.clientConfirmed ? (
            <AwaitingConfirmationBadge openQuestions={plan.openQuestions} />
          ) : plan.current ? (
            <Badge variant="success">Confirmed</Badge>
          ) : null}
        </TableCell>
      </TableRow>
    ));
  }

  return (
    <>
      <PageHeader
        title="Family plans"
        description="Who a family may include in each Employee Benefits product: slots, relationships and their maximums, by version."
        actions={
          canManage ? (
            <FamilyPlanFormSheet trigger={newButton} initialProduct={product} />
          ) : undefined
        }
      />
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Product">
        {EB_PRODUCTS.map((item) => (
          <Button
            key={item}
            type="button"
            size="sm"
            variant={item === product ? 'default' : 'outline'}
            aria-pressed={item === product}
            onClick={() => setProduct(item)}
          >
            {EB_PRODUCT_LABELS[item]}
          </Button>
        ))}
      </div>
      <Card className="py-0">
        <Table>
          <TableCaption className="sr-only">{EB_PRODUCT_LABELS[product]} family plans</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Version in effect</TableHead>
              <TableHead>Client confirmation</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{body}</TableBody>
        </Table>
      </Card>
    </>
  );
}
