'use client';

import { FileSpreadsheet, Link2, Plus, Search, Settings } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { ClaimsBoard } from '@/components/claims/claims-board';
import { ClaimsTable } from '@/components/claims/claims-table';
import { CompanyFilter } from '@/components/claims/claim-ui';
import { DemoModeGate } from '@/components/demo-mode-gate';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { usePermission } from '@/hooks/use-permission';
import { cn } from '@/lib/utils';

/** Group health claims (C1): the board of statuses, or the table, with search and company. */
export function ClaimsView({ initialView }: { initialView: 'board' | 'table' }) {
  const canProcess = usePermission('claims.process');
  const canAdmin = usePermission('claims.admin');
  const [view, setView] = useState(initialView);
  const [text, setText] = useState('');
  const [clientId, setClientId] = useState('');
  const q = useDebouncedValue(text, 250);
  const choose = (next: 'board' | 'table') => {
    setView(next);
    window.history.replaceState(null, '', next === 'table' ? '/claims?view=table' : '/claims');
  };
  return (
    <>
      <PageHeader
        title="Claims"
        description="Group health claims: drag a card to its next stage, with a remark; the claimant and HR are emailed."
        actions={
          <>
            {canAdmin ? (
              <Button asChild variant="outline">
                <Link href="/claims/settings">
                  <Settings aria-hidden="true" />
                  Emails and HR
                </Link>
              </Button>
            ) : null}
            <Button asChild variant="outline">
              <Link href="/claims/tpa">
                <FileSpreadsheet aria-hidden="true" />
                TPA claims
              </Link>
            </Button>
            {canProcess ? (
              <>
                <Button asChild variant="outline">
                  <Link href="/claims/links">
                    <Link2 aria-hidden="true" />
                    Submission links
                  </Link>
                </Button>
                <Button asChild>
                  <Link href="/claims/new">
                    <Plus aria-hidden="true" />
                    New claim
                  </Link>
                </Button>
              </>
            ) : null}
          </>
        }
      />
      <DemoModeGate>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-md border p-0.5" role="group" aria-label="View">
            {(['board', 'table'] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={view === value}
                onClick={() => choose(value)}
                className={cn(
                  'rounded px-3 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  view === value
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted',
                )}
              >
                {value === 'board' ? 'Board' : 'Table'}
              </button>
            ))}
          </div>
          <div className="relative min-w-60 flex-1">
            <Search
              aria-hidden="true"
              className="absolute top-2.5 left-2.5 size-4 text-muted-foreground"
            />
            <Input
              type="search"
              aria-label="Search claims"
              placeholder="Claim number, employee, patient or hospital"
              className="pl-8"
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
          </div>
          <CompanyFilter value={clientId} onChange={setClientId} />
        </div>
        {view === 'board' ? (
          <ClaimsBoard q={q} clientId={clientId} />
        ) : (
          <ClaimsTable key={`${q}|${clientId}`} q={q} clientId={clientId} />
        )}
      </DemoModeGate>
    </>
  );
}
