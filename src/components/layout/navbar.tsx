'use client';

import { Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import type { RefObject } from 'react';
import { Button } from '@/components/ui/button';
import type { User } from '@/shared';
import { Breadcrumbs } from './breadcrumbs';
import { DemoBadge } from './demo-badge';
import { NotificationsMenu } from './notifications-menu';
import { SearchTrigger } from './search-trigger';
import { SIDEBAR_ID } from './sidebar/sidebar';
import { ThemeToggle } from './theme-toggle';
import { UserMenu } from './user-menu';

export interface NavbarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  navOpen: boolean;
  onOpenNav: () => void;
  menuButtonRef: RefObject<HTMLButtonElement | null>;
  onOpenSearch: () => void;
  user: User | undefined;
  demoMode: boolean;
}

/**
 * The top bar: sidebar button and breadcrumbs on the left; search, demo badge, theme and user
 * menu on the right. CSS decides which sidebar button shows: the collapse toggle at 1024 px and
 * wider, the drawer's menu button below.
 */
export function Navbar({
  collapsed,
  onToggleCollapsed,
  navOpen,
  onOpenNav,
  menuButtonRef,
  onOpenSearch,
  user,
  demoMode,
}: NavbarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card px-3 sm:gap-3 md:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="hidden shrink-0 lg:inline-flex"
        onClick={onToggleCollapsed}
        aria-controls={SIDEBAR_ID}
        aria-expanded={!collapsed}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
      </Button>
      <Button
        ref={menuButtonRef}
        variant="ghost"
        size="icon"
        className="shrink-0 lg:hidden"
        onClick={onOpenNav}
        aria-haspopup="dialog"
        aria-expanded={navOpen}
        aria-label="Open navigation"
      >
        <Menu aria-hidden="true" />
      </Button>
      <Breadcrumbs className="flex-1" />
      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <SearchTrigger onOpen={onOpenSearch} />
        {demoMode ? <DemoBadge /> : null}
        <NotificationsMenu />
        <ThemeToggle />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
