import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

class ResizeObserverStub implements ResizeObserver {
  observe(): void {
    // jsdom has no layout, so there is nothing to observe.
  }
  unobserve(): void {
    // See observe().
  }
  disconnect(): void {
    // See observe().
  }
}

// jsdom lacks these browser APIs, which next-themes (matchMedia), Radix (ResizeObserver, pointer
// capture), Recharts (ResizeObserver) and cmdk (scrollIntoView) use. Route handler tests run in
// the Node environment, which has no window at all.
if (typeof window !== 'undefined') {
  if (typeof window.matchMedia !== 'function') {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: (query: string): MediaQueryList => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }),
    });
  }
  if (typeof globalThis.ResizeObserver !== 'function')
    globalThis.ResizeObserver = ResizeObserverStub;
  if (typeof Element.prototype.hasPointerCapture !== 'function') {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => undefined;
    Element.prototype.releasePointerCapture = () => undefined;
  }
  if (typeof Element.prototype.scrollIntoView !== 'function') {
    Element.prototype.scrollIntoView = () => undefined;
  }
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
