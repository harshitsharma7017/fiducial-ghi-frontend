'use client';

import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from 'react';
import { ErrorState } from '@/components/states';
import { useCurrentUser } from '@/hooks/use-current-user';
import { DemoModeProvider } from '@/hooks/use-demo-mode';
import { ApiError } from '@/lib/api-client';
import { isPaletteShortcut } from '@/lib/platform';
import { writeSidebarCookie } from '@/lib/sidebar-state';
import { CommandPalette } from './command-palette';
import { MobileNav } from './mobile-nav';
import { Navbar } from './navbar';
import { PageGate } from './page-gate';
import { Sidebar } from './sidebar/sidebar';

/**
 * The frame around every signed-in page: skip link, sidebar (a drawer below 1024 px), navbar,
 * command palette and the main landmark. The frame renders at once; the parts that need the
 * user show skeletons until it loads.
 */
export function AppShell({
  children,
  defaultCollapsed,
  demoMode,
}: {
  children: ReactNode;
  defaultCollapsed: boolean;
  demoMode: boolean;
}) {
  const me = useCurrentUser();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [navOpen, setNavOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const paletteReturnFocusRef = useRef<HTMLElement | null>(null);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    writeSidebarCookie(next);
  }

  function openPalette() {
    paletteReturnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setPaletteOpen(true);
  }

  // ⌘K on Apple platforms and Ctrl+K elsewhere, from anywhere in the shell, text fields included.
  // preventDefault stops the browser's own Ctrl+K search.
  const onShortcut = useEffectEvent((event: KeyboardEvent) => {
    if (!isPaletteShortcut(event)) return;
    event.preventDefault();
    if (paletteOpen) setPaletteOpen(false);
    else openPalette();
  });
  useEffect(() => {
    const listener = (event: KeyboardEvent) => onShortcut(event);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  const user = me.data;
  // A 401 already sends the browser to the sign-in page (apiFetch), so it needs no message here.
  const failed = me.isError && !(me.error instanceof ApiError && me.error.status === 401);

  return (
    <DemoModeProvider value={demoMode}>
      <div className="flex min-h-screen">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:shadow focus:ring-2 focus:ring-ring"
        >
          Skip to content
        </a>
        <Sidebar collapsed={collapsed} user={user} />
        <MobileNav
          open={navOpen}
          onOpenChange={setNavOpen}
          returnFocusRef={menuButtonRef}
          user={user}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <Navbar
            collapsed={collapsed}
            onToggleCollapsed={toggleCollapsed}
            navOpen={navOpen}
            onOpenNav={() => setNavOpen(true)}
            menuButtonRef={menuButtonRef}
            onOpenSearch={openPalette}
            user={user}
            demoMode={demoMode}
          />
          <main id="main" tabIndex={-1} className="flex-1 p-4 outline-none md:p-6 lg:p-8">
            {failed ? (
              <ErrorState
                error={me.error}
                onRetry={() => void me.refetch()}
                title="Could not load your account"
              />
            ) : (
              <PageGate roles={user?.roles}>{children}</PageGate>
            )}
          </main>
        </div>
        <CommandPalette
          open={paletteOpen}
          onOpenChange={setPaletteOpen}
          roles={user?.roles}
          returnFocusRef={paletteReturnFocusRef}
        />
      </div>
    </DemoModeProvider>
  );
}
