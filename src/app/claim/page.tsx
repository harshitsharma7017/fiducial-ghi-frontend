import type { Metadata } from 'next';
import { PublicClaim } from '@/components/claims/public-claim';
import { ThemeToggle } from '@/components/layout/theme-toggle';

export const metadata: Metadata = {
  title: 'Submit a health claim',
  // The page carries a personal link: never cached or sent on as a referrer.
  referrer: 'no-referrer',
};

/** The employee's claim submission page (C2): no sign-in; the link's token is the credential. */
export default function ClaimSubmissionPage() {
  return (
    <main className="mx-auto grid min-h-screen max-w-3xl content-start gap-6 px-4 py-10">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span
            className="grid size-8 place-items-center rounded bg-accent text-sm font-bold text-accent-foreground"
            aria-hidden="true"
          >
            F
          </span>
          <div className="grid">
            <h1 className="text-xl font-semibold text-primary">Submit a health claim</h1>
            <p className="text-sm text-muted-foreground">Fiducial Insurance Brokers</p>
          </div>
        </div>
        <ThemeToggle />
      </header>
      <PublicClaim />
    </main>
  );
}
