'use client';

import { createContext, use, type ReactNode } from 'react';

const DemoModeContext = createContext(false);

/** Provided by the signed-in layout, which reads USE_MOCK_API on the server. */
export function DemoModeProvider({ value, children }: { value: boolean; children: ReactNode }) {
  return <DemoModeContext value={value}>{children}</DemoModeContext>;
}

/** True when the BFF runs in mock mode: pages that need the API show a demo-mode state instead. */
export function useDemoMode(): boolean {
  return use(DemoModeContext);
}
