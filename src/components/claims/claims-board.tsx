'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Clock, GripVertical } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { ErrorState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { claimBoardQuery } from '@/lib/api/claims';
import { cn } from '@/lib/utils';
import {
  CLAIM_STATUS_LABELS,
  CLAIM_TRANSITIONS,
  GHI_RELATIONSHIP_LABELS,
  canMoveClaim,
  type ClaimCard,
  type ClaimStatus,
} from '@/shared';
import { MoveDialog, daysText, inr, type PendingMove } from './claim-ui';

/**
 * The claims board (C1): a column per status. A card the user may move (assigned to them, or
 * they are an Admin) can be dragged to the next column, or moved with its "Move to" button; both
 * ask for the remark first. The API checks the move again.
 */
export function ClaimsBoard({ q, clientId }: { q: string; clientId: string }) {
  const board = useQuery(claimBoardQuery({ q, clientId }));
  const [dragged, setDragged] = useState<ClaimCard | null>(null);
  const [over, setOver] = useState<ClaimStatus | null>(null);
  const [move, setMove] = useState<PendingMove | null>(null);

  if (board.isError) return <ErrorState error={board.error} onRetry={() => void board.refetch()} />;
  const ask = (card: ClaimCard, to: ClaimStatus) =>
    setMove({ claimId: card.id, claimNumber: card.claimNumber, from: card.status, to });

  return (
    <>
      <div
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
        role="list"
        aria-label="Claims board"
      >
        {(board.data?.columns ?? []).length === 0 && board.isPending
          ? Array.from({ length: 4 }, (_, index) => (
              <div key={index} role="status" className="grid gap-2 rounded-lg border bg-card p-3">
                <span className="sr-only">Loading the board</span>
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ))
          : board.data?.columns.map((column) => {
              const droppable = dragged !== null && canMoveClaim(dragged.status, column.status);
              return (
                <section
                  key={column.status}
                  role="listitem"
                  aria-label={`${CLAIM_STATUS_LABELS[column.status]}: ${column.total} claims`}
                  className={cn(
                    'flex min-h-48 flex-col gap-2 rounded-lg border bg-muted/40 p-3 transition-colors',
                    droppable && 'border-primary border-dashed',
                    droppable && over === column.status && 'bg-primary-soft/50',
                  )}
                  onDragOver={(event) => {
                    if (!droppable) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                    setOver(column.status);
                  }}
                  onDragLeave={() =>
                    setOver((current) => (current === column.status ? null : current))
                  }
                  onDrop={(event) => {
                    event.preventDefault();
                    if (dragged && droppable) ask(dragged, column.status);
                    setDragged(null);
                    setOver(null);
                  }}
                >
                  <h2 className="flex items-center justify-between text-sm font-semibold">
                    {CLAIM_STATUS_LABELS[column.status]}
                    <span className="rounded-full bg-card px-2 text-xs font-normal text-muted-foreground tabular">
                      {column.total}
                    </span>
                  </h2>
                  {column.items.length === 0 ? (
                    <p className="py-6 text-center text-xs text-muted-foreground">No claims</p>
                  ) : (
                    <ul className="grid gap-2">
                      {column.items.map((card) => (
                        <ClaimCardItem
                          key={card.id}
                          card={card}
                          dragging={dragged?.id === card.id}
                          onDragStart={() => setDragged(card)}
                          onDragEnd={() => {
                            setDragged(null);
                            setOver(null);
                          }}
                          onMove={(to) => ask(card, to)}
                        />
                      ))}
                    </ul>
                  )}
                  {column.total > column.items.length ? (
                    <p className="text-xs text-muted-foreground">
                      Showing the {column.items.length} longest waiting; use the table for the rest.
                    </p>
                  ) : null}
                </section>
              );
            })}
      </div>
      <MoveDialog move={move} onClose={() => setMove(null)} />
    </>
  );
}

function ClaimCardItem({
  card,
  dragging,
  onDragStart,
  onDragEnd,
  onMove,
}: {
  card: ClaimCard;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onMove: (to: ClaimStatus) => void;
}) {
  const next = card.canMove ? CLAIM_TRANSITIONS[card.status] : [];
  return (
    <li
      draggable={card.canMove}
      onDragStart={(event) => {
        event.dataTransfer.setData('text/plain', card.id);
        event.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={cn(
        'grid gap-1.5 rounded-md border bg-card p-3 text-sm shadow-xs',
        card.canMove && 'cursor-grab',
        dragging && 'opacity-50',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/claims/${card.id}`}
          className="font-medium text-accent-strong outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          {card.claimNumber}
        </Link>
        {card.canMove ? (
          <GripVertical aria-hidden="true" className="size-4 text-muted-foreground" />
        ) : null}
      </div>
      <p>
        {card.employeeName}
        <span className="text-muted-foreground">
          {' '}
          · patient {card.patientName} ({GHI_RELATIONSHIP_LABELS[card.relationship]})
        </span>
      </p>
      <p className="text-muted-foreground">{card.hospital}</p>
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold tabular">{inr(card.amountClaimed)}</span>
        <span
          className="flex items-center gap-1 text-xs text-muted-foreground tabular"
          title="Time in this stage"
        >
          <Clock aria-hidden="true" className="size-3" />
          <span className="sr-only">In this stage: </span>
          {daysText(card.daysInStage)}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        {card.assignedTo ? `Assigned to ${card.assignedTo.name}` : 'Not assigned'}
      </p>
      {card.settled || card.tpaStatus ? (
        <p className="flex flex-wrap items-center gap-1 text-xs">
          {card.settled ? <Badge variant="success">Settled</Badge> : null}
          {card.tpaStatus ? (
            <span className="text-muted-foreground">TPA: {card.tpaStatus}</span>
          ) : null}
        </p>
      ) : null}
      {next.map((to) => (
        <Button
          key={to}
          type="button"
          size="sm"
          variant="outline"
          className="justify-self-start"
          onClick={() => onMove(to)}
        >
          Move to {CLAIM_STATUS_LABELS[to]}
          <ArrowRight aria-hidden="true" />
        </Button>
      ))}
    </li>
  );
}
