'use client';

import type { ReactNode } from 'react';
import { DemoModeState } from '@/components/states';
import { useDemoMode } from '@/hooks/use-demo-mode';

/**
 * Wraps a page that reads live data from Fiducial_backend. In mock mode it shows the demo-mode
 * state instead, so no request is sent that could only fail with a 503.
 */
export function DemoModeGate({ children }: { children: ReactNode }) {
  const demoMode = useDemoMode();
  return demoMode ? <DemoModeState /> : <>{children}</>;
}
