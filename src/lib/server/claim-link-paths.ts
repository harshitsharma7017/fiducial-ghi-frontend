// The employee claim link's BFF (app/api/public/claim-link): the header its token travels in and
// the only API paths it forwards (C2). Server only.

export const CLAIM_LINK_HEADER = 'x-claim-link-token';

/** The link paths an employee may call: the link, its claims, and a claim's documents. */
export function isClaimLinkPath(path: readonly string[], method: string): boolean {
  if (path.length === 0) return method === 'GET';
  if (path.length === 1) return path[0] === 'claims' && method === 'POST';
  return (
    path.length === 3 &&
    path[0] === 'claims' &&
    /^CLM-\d{4}-\d{4,}$/.test(path[1] ?? '') &&
    path[2] === 'documents' &&
    method === 'POST'
  );
}
