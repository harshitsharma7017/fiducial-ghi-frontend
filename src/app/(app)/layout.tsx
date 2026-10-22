import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { isMockApi } from '@/lib/server/mock-mode';
import { SIDEBAR_COOKIE, isSidebarCollapsed } from '@/lib/sidebar-state';

/**
 * Reads the kept sidebar state on the server, so the page renders collapsed or expanded from the
 * first paint. Reading the cookie makes signed-in pages render per request.
 */
export default async function SignedInLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const collapsed = isSidebarCollapsed(cookieStore.get(SIDEBAR_COOKIE)?.value);
  return (
    <AppShell defaultCollapsed={collapsed} demoMode={isMockApi()}>
      {children}
    </AppShell>
  );
}
