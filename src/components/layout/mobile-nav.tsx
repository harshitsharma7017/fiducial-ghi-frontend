'use client';

import type { RefObject } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import type { CurrentUser } from '@/shared';
import { SidebarBrand } from './sidebar/sidebar';
import { SidebarNav } from './sidebar/sidebar-nav';
import { SidebarUser } from './sidebar/sidebar-user';

/**
 * The sidebar as a slide-in drawer below 1024 px. It traps focus, closes on Escape, on the
 * overlay and after navigation, and then returns focus to the navbar's menu button. Radix only
 * returns focus to its own trigger, and the menu button is not one.
 */
export function MobileNav({
  open,
  onOpenChange,
  returnFocusRef,
  user,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
  user: CurrentUser | undefined;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="w-72 gap-0 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground sm:max-w-72 lg:hidden"
        closeClassName="focus-visible:ring-sidebar-ring"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocusRef.current?.focus();
        }}
      >
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <SheetDescription className="sr-only">Main navigation</SheetDescription>
        <SidebarBrand collapsed={false} />
        <SidebarNav permissions={user?.permissions} onNavigate={() => onOpenChange(false)} />
        <SidebarUser user={user} collapsed={false} />
      </SheetContent>
    </Sheet>
  );
}
