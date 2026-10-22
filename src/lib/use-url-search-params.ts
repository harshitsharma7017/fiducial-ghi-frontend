'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * The current URL query string, kept in sync without a full navigation. Reads
 * `window.location.search` in the browser and the page's server `searchParams` on the server and
 * during hydration, so the first render matches. Writes use `history.replaceState` (which Next.js
 * keeps in sync with its router), so switching filters adds no history entry, then a custom event
 * updates every reader.
 */
const SEARCH_CHANGED = 'erp:searchchange';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('popstate', onChange);
  window.addEventListener(SEARCH_CHANGED, onChange);
  return () => {
    window.removeEventListener('popstate', onChange);
    window.removeEventListener(SEARCH_CHANGED, onChange);
  };
}

function getClientSearch(): string {
  return window.location.search;
}

export interface UrlSearchParams {
  params: URLSearchParams;
  /** Replaces the query string (pass "" to clear it) without adding a history entry. */
  replace: (search: string) => void;
}

export function useUrlSearchParams(serverSearch: string): UrlSearchParams {
  const search = useSyncExternalStore(subscribe, getClientSearch, () => normalise(serverSearch));

  const replace = useCallback((next: string) => {
    const query = next === '' || next.startsWith('?') ? next : `?${next}`;
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${query}`);
    window.dispatchEvent(new Event(SEARCH_CHANGED));
  }, []);

  return { params: new URLSearchParams(search), replace };
}

function normalise(search: string): string {
  if (search === '') return '';
  return search.startsWith('?') ? search : `?${search}`;
}
