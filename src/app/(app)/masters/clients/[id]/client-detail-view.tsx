'use client';

import { useQuery } from '@tanstack/react-query';
import { History, Pencil } from 'lucide-react';
import Link from 'next/link';
import { ClientDetailsCard } from '@/components/clients/client-details-card';
import { EmployeesCard } from '@/components/clients/employees-card';
import { ClientFormSheet } from '@/components/clients/client-form-sheet';
import { PlanDefaultsCard } from '@/components/clients/plan-defaults-card';
import { PageHeader } from '@/components/page-header';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { usePermission } from '@/hooks/use-permission';
import { ApiError } from '@/lib/api-client';
import { clientQuery } from '@/lib/client-query';

const OBJECT_ID = /^[a-f0-9]{24}$/i;

export function ClientDetailView({ id }: { id: string }) {
  const canManage = usePermission('clients.manage');
  const canViewAudit = usePermission('audit.view');
  const canViewCases = usePermission('proposals.view');
  const validId = OBJECT_ID.test(id);
  const client = useQuery(clientQuery(validId ? id : null));

  const notFound = !validId || (client.error instanceof ApiError && client.error.status === 404);
  if (notFound) {
    return (
      <EmptyState
        title="Client not found"
        description={
          <Link
            href="/masters/clients"
            className="rounded-sm text-accent-strong underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            Back to clients
          </Link>
        }
      />
    );
  }
  if (client.isPending) return <LoadingState label="Loading client…" />;
  if (client.isError) {
    return <ErrorState error={client.error} onRetry={() => void client.refetch()} />;
  }

  const data = client.data;
  return (
    <>
      <PageHeader
        title={data.name}
        description={`${data.address.city}, ${data.address.state}`}
        actions={
          <>
            {canViewAudit ? (
              <Button asChild variant="outline">
                <Link href={`/audit?entity=client&entityId=${data.id}`}>
                  <History aria-hidden="true" />
                  History
                </Link>
              </Button>
            ) : null}
            {canManage ? (
              <ClientFormSheet
                client={data}
                trigger={
                  <Button>
                    <Pencil aria-hidden="true" />
                    Edit client
                  </Button>
                }
              />
            ) : null}
          </>
        }
      />
      <div className="grid gap-4">
        <ClientDetailsCard client={data} />
        <PlanDefaultsCard clientId={data.id} />
        {canViewCases ? <EmployeesCard clientId={data.id} /> : null}
      </div>
    </>
  );
}
