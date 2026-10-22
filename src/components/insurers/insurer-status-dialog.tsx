'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CircleCheck, CircleOff, LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { errorMessage } from '@/components/states';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { InsurerSchema, type Insurer } from '@/shared';

/** Deactivates an insurer (kept on record, not offered for new RFQs) or reactivates it. */
export function InsurerStatusDialog({ insurer }: { insurer: Insurer }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const deactivating = insurer.active;
  const label = `${insurer.company}, ${insurer.branch}`;

  const update = useMutation({
    mutationFn: () =>
      apiFetch(`insurers/${insurer.id}`, {
        method: 'PATCH',
        body: { active: !insurer.active },
        schema: InsurerSchema,
      }),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.insurers.all });
      toast({
        title: saved.active ? 'Insurer activated' : 'Insurer deactivated',
        description: label,
        variant: 'success',
      });
      setOpen(false);
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) update.reset();
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={`${deactivating ? 'Deactivate' : 'Activate'} ${label}`}
        >
          {deactivating ? <CircleOff aria-hidden="true" /> : <CircleCheck aria-hidden="true" />}
          {deactivating ? 'Deactivate' : 'Activate'}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{deactivating ? 'Deactivate insurer' : 'Activate insurer'}</DialogTitle>
          <DialogDescription>
            {deactivating
              ? `${label} stays on record but is no longer offered for new RFQs.`
              : `${label} will be offered for new RFQs again.`}
          </DialogDescription>
        </DialogHeader>
        {update.isError ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{errorMessage(update.error)}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant={deactivating ? 'destructive' : 'default'}
            disabled={update.isPending}
            onClick={() => update.mutate()}
          >
            {update.isPending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
            {deactivating ? 'Deactivate' : 'Activate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
