'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ReactNode } from 'react';

/** localStorage key for the chosen theme: "light", "dark" or "system". */
export const THEME_STORAGE_KEY = 'erp-theme';

// next-themes 0.4.6 renders its no-flash script through React, and React 19.2 and later report
// every script element a component renders, in development only ("Encountered a script tag
// while rendering React component"). Here it is a false positive: the script runs during server
// rendering, before hydration (https://github.com/shadcn-ui/ui/issues/10104). Drop only that
// message, only in development, and only once even when this module is reloaded.
const SCRIPT_TAG_WARNING = 'Encountered a script tag';
const FILTER_INSTALLED = Symbol.for('fiducial.themeScriptWarningFilter');

if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  const target = console as Console & { [FILTER_INSTALLED]?: true };
  if (!target[FILTER_INSTALLED]) {
    target[FILTER_INSTALLED] = true;
    const consoleError = console.error.bind(console);
    console.error = (...args: unknown[]) => {
      if (typeof args[0] === 'string' && args[0].includes(SCRIPT_TAG_WARNING)) return;
      consoleError(...args);
    };
  }
}

/**
 * Light, dark or system theme, applied as the "dark" class on <html> by an inline script before
 * the first paint, so the page never flashes the other theme. The choice is kept in localStorage.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey={THEME_STORAGE_KEY}
    >
      {children}
    </NextThemesProvider>
  );
}
