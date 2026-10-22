'use client';

import { useSyncExternalStore } from 'react';
import { isApplePlatform } from '@/lib/platform';

type Platform = 'apple' | 'other';

function subscribe(): () => void {
  // The platform never changes while the page is open.
  return () => undefined;
}

function getPlatform(): Platform {
  return isApplePlatform() ? 'apple' : 'other';
}

/**
 * "apple" or "other" in the browser; null on the server and during hydration, so the first
 * browser render matches the server markup.
 */
export function usePlatform(): Platform | null {
  return useSyncExternalStore(subscribe, getPlatform, () => null);
}
