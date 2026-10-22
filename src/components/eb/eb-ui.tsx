import type * as React from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/** A labelled field with its control and, under it, any message (several children allowed). */
export function Field({
  label,
  children,
  hint,
  className,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <Label className={cn('grid gap-1 text-sm font-normal', className)}>
      <span>{label}</span>
      {children}
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </Label>
  );
}
