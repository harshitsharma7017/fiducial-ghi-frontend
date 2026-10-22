'use client';

import { useSyncExternalStore } from 'react';

const TICK_MS = 60_000;
const listeners = new Set<() => void>();
let nowMs = 0;
let timer: ReturnType<typeof setInterval> | undefined;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  timer ??= setInterval(() => {
    nowMs = Date.now();
    for (const notify of listeners) notify();
  }, TICK_MS);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== undefined) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

/** The same value for every call within a minute, as useSyncExternalStore requires. */
function getSnapshot(): number {
  if (Date.now() - nowMs >= TICK_MS) nowMs = Date.now();
  return nowMs;
}

function getServerSnapshot(): null {
  return null;
}

/**
 * The current time in milliseconds, read only in the browser and updated every minute. It is
 * null on the server and during hydration, so both renders match; show a skeleton or a
 * clock-free fallback until it is set. Components must not read the clock during render.
 */
export function useIstNow(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
