// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { isClaimLinkPath } from './claim-link-paths';

describe('isClaimLinkPath', () => {
  it('forwards only the link, its claims and their documents', () => {
    expect(isClaimLinkPath([], 'GET')).toBe(true);
    expect(isClaimLinkPath(['claims'], 'POST')).toBe(true);
    expect(isClaimLinkPath(['claims', 'CLM-2026-0001', 'documents'], 'POST')).toBe(true);
  });

  it('refuses anything else', () => {
    expect(isClaimLinkPath([], 'POST')).toBe(false);
    expect(isClaimLinkPath(['claims'], 'GET')).toBe(false);
    expect(isClaimLinkPath(['claims', '..', 'documents'], 'POST')).toBe(false);
    expect(isClaimLinkPath(['claims', 'CLM-2026-0001', 'transitions'], 'POST')).toBe(false);
    expect(isClaimLinkPath(['..', '..', 'claims'], 'GET')).toBe(false);
  });
});
