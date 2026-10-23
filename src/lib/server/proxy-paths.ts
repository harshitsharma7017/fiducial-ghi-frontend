// Only these API areas are reachable through /api/proxy: the ones this Employee Benefits app
// calls. Property-only areas (imports, catalog, document templates, the QCR and placement slip
// lists) stay with Fiducial_frontend. Sign-in is not reachable: it returns a token, and the token
// must never reach the browser (see /api/auth/login). The API checks each user's permission for
// every area (audit, for example, is Admin only).
const ALLOWED_AREAS = new Set([
  'users',
  // Database-driven roles: the roles page and the user form's role selector.
  'roles',
  'masters',
  'clients',
  'insurers',
  'email-templates',
  'mail',
  // The signed-in user's in-app notifications (A4).
  'notifications',
  // The case owners for a new case, and the email template preview's sample case.
  'proposals',
  // Group health (GHI) cases and their census, RFQ, quotes, QCR, payments and placement.
  'ghi',
  // Employee Benefits: GPA and GTLI cases, cases of every product, templates, company employees.
  'eb',
  // The Family Plan Master.
  'family-plans',
  // The Age Band Master (N4).
  'age-bands',
  // Group health claims (staff). The employee's link uses /api/public/claim-link instead.
  'claims',
  // TPA claims files, formats and imported claims (N9, N11).
  'tpa',
  // Claims analysis with premium endorsements (N10), and the renewal analysis (N8).
  'claims-analysis',
  'renewal',
  'health',
  'audit',
]);

/** True when the proxied path is one the browser may call. */
export function isAllowedProxyPath(segments: string[]): boolean {
  if (segments.length === 0) return false;
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..'))
    return false;
  const [area, next] = segments;
  if (area === 'auth') return segments.length === 2 && next === 'me';
  return area !== undefined && ALLOWED_AREAS.has(area);
}
