'use client';

import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { usePlatform } from '@/hooks/use-platform';

/**
 * Opens the command palette. A field-like button from 640 px, an icon button below. The shortcut
 * hint appears after hydration, once the platform is known.
 */
export function SearchTrigger({ onOpen }: { onOpen: () => void }) {
  const platform = usePlatform();
  const hint = platform === 'apple' ? '⌘K' : platform === 'other' ? 'Ctrl K' : null;
  const keys = platform === 'apple' ? 'Meta+K' : platform === 'other' ? 'Control+K' : undefined;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={onOpen}
        aria-keyshortcuts={keys}
        className="hidden h-9 w-48 justify-between gap-3 px-3 font-normal text-muted-foreground sm:flex lg:w-64"
      >
        <span className="flex items-center gap-2">
          <Search aria-hidden="true" />
          Search<span className="sr-only"> pages</span>
        </span>
        {hint ? <Kbd>{hint}</Kbd> : null}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onOpen}
        aria-keyshortcuts={keys}
        aria-label="Search"
        className="sm:hidden"
      >
        <Search aria-hidden="true" />
      </Button>
    </>
  );
}
