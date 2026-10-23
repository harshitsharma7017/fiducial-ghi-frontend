import { describe, expect, it } from 'vitest';
import { isAllowedProxyPath } from './proxy-paths';

describe('isAllowedProxyPath', () => {
  it.each([
    [['users']],
    [['roles']],
    [['roles', 'GPA_CASE_VIEWER', 'deactivate']],
    [['masters', 'occupancies']],
    [['clients']],
    [['clients', '0123456789abcdef01234567', 'locations']],
    [['insurers', '0123456789abcdef01234567']],
    [['proposals', 'owners']],
    [['health']],
    [['audit']],
    [['email-templates']],
    [['email-templates', 'RFQ']],
    [['mail', 'status']],
    [['notifications']],
    [['notifications', 'unread-count']],
    [['notifications', '0123456789abcdef01234567', 'read']],
    [['ghi', 'cases']],
    [['claims', 'board']],
    [['ghi', 'cases', '0123456789abcdef01234567', 'census', 'imports']],
    [['eb', 'cases']],
    [['eb', 'gpa', 'cases', '0123456789abcdef01234567', 'rfq']],
    [['family-plans']],
    [['family-plans', '0123456789abcdef01234567', 'versions']],
    [['age-bands', '0123456789abcdef01234567', 'cases']],
    // N8 to N11: TPA claims, the claims analysis and the renewal analysis.
    [['tpa', 'imports', '0123456789abcdef01234567', 'rows']],
    [['claims-analysis']],
    [['claims-analysis', 'premium', '0123456789abcdef01234567']],
    [['renewal', 'analysis', 'document']],
    [['auth', 'me']],
  ])('allows %j', (segments) => {
    expect(isAllowedProxyPath(segments)).toBe(true);
  });

  it.each([
    [[]],
    [['auth', 'login']],
    [['auth']],
    [['quotes']],
    [['mailer']],
    [['rating', 'fire']],
    [['clients', '..', 'auth', 'login']],
    [['clients', '']],
    [['ghi', '..', 'auth', 'login']],
    [['claim-links', 'current']],
    [['ebx']],
    [['family']],
    [['eb', '..', 'auth', 'login']],
    [['tpa', '..', 'auth', 'login']],
    [['renewals']],
    // Property-only areas stay with Fiducial_frontend.
    [['imports', 'clients', 'template']],
    [['catalog']],
    [['templates']],
    [['qcrs']],
    [['placement-slips']],
  ])('rejects %j', (segments) => {
    expect(isAllowedProxyPath(segments)).toBe(false);
  });
});
