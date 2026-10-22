import { connection } from 'next/server';
import type { ReactNode } from 'react';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { isMockApi } from '@/lib/server/mock-mode';
import { DEMO_PASSWORD, DEMO_USERS } from '@/lib/server/mock-mode';

const VALUE_POINTS = [
  'Enter each risk once',
  'Rate consistently from versioned masters',
  'Keep a full audit trail',
];

/**
 * Two columns from 1024 px (left panel on the sidebar colours, form on the right); the form only
 * below. `connection()` makes both pages render per request, so USE_MOCK_API is read at runtime,
 * not baked in at build time.
 */
export default async function AuthLayout({ children }: { children: ReactNode }) {
  await connection();
  const demoMode = isMockApi();

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-2">
          <span
            className="grid size-8 place-items-center rounded bg-accent text-sm font-bold text-accent-foreground"
            aria-hidden="true"
          >
            F
          </span>
          <span className="text-sm font-semibold tracking-wide">Fiducial Insurance Brokers</span>
        </div>
        <div className="max-w-md">
          <h1 className="text-3xl font-semibold text-balance">Fiducial</h1>
          <p className="mt-3 text-sidebar-muted">
            Property insurance placement, from Data Sheet to Placement Slip, in one place.
          </p>
          <ul className="mt-8 grid gap-3">
            {VALUE_POINTS.map((point) => (
              <li key={point} className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="size-1.5 shrink-0 rounded-full bg-sidebar-ring"
                />
                {point}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-sidebar-muted">Spirezen Enterprises</p>
      </section>

      <section className="flex flex-col px-4 py-8 sm:px-6">
        <div className="flex justify-end">
          <ThemeToggle />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-8">
          <div className="mb-6 lg:hidden">
            <p className="text-xs font-semibold tracking-widest text-accent-strong uppercase">
              Property insurance placement
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-primary">Fiducial</h1>
          </div>
          {demoMode ? (
            <Alert variant="info" className="mb-6">
              <AlertTitle>Demo mode</AlertTitle>
              <AlertDescription>
                Sign in as{' '}
                {DEMO_USERS.map((user, index) => (
                  <span key={user.email}>
                    {index > 0 ? ' or ' : ''}
                    <code className="rounded bg-muted px-1 py-0.5 text-xs">{user.email}</code>
                  </span>
                ))}{' '}
                with the password{' '}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">{DEMO_PASSWORD}</code>. The
                API is not called.
              </AlertDescription>
            </Alert>
          ) : null}
          {children}
        </div>
      </section>
    </main>
  );
}
