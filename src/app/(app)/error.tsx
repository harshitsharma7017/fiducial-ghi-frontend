'use client';

import { ErrorState } from '@/components/states';

/** Unexpected render errors in a signed-in page, shown inside the shell. */
export default function SignedInError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorState error={error} onRetry={retry} title="This page could not be shown" />;
}
