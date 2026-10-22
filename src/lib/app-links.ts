// Links into the other Fiducial frontend. Property, Fire and Burglary proposals live in
// Fiducial_frontend; NEXT_PUBLIC_PROPERTY_APP_URL is its public URL. It is not a secret: Next.js
// inlines it into the browser bundle at build time. Unset, or not an http(s) URL: no link.

function appBaseUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.href.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

const PROPERTY_APP_URL = appBaseUrl(process.env.NEXT_PUBLIC_PROPERTY_APP_URL);

/** The Property app's URL for a path such as /proposals/{id}, or null when it is not configured. */
export function propertyAppUrl(path: string): string | null {
  return PROPERTY_APP_URL ? `${PROPERTY_APP_URL}${path}` : null;
}
