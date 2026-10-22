import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: { default: 'Fiducial', template: '%s · Fiducial' },
  description: 'Property insurance placement for Fiducial',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // The theme script sets the class on <html> before React hydrates, so its attributes differ.
    <html lang="en-IN" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
