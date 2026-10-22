import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Notification } from '@/shared';

// Where a notification opens: Employee Benefits cases in this app; Property proposals in
// Fiducial_frontend, only when NEXT_PUBLIC_PROPERTY_APP_URL names it.

const ID = 'bbbbbbbbbbbbbbbbbbbbbbbb';

function notification(entity: Notification['entity'], reference: string | null): Notification {
  return {
    id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
    event: 'APPROVAL_NEEDED',
    title: 'RFQ needs approval',
    message: 'RFQ v1 was submitted for approval.',
    entity,
    entityId: ID,
    proposalId: entity === 'proposal' ? ID : null,
    reference,
    read: false,
    readAt: null,
    createdAt: '2026-10-20T09:00:00.000Z',
  };
}

/** notificationHref with the Property app's URL set to value (read when the module loads). */
async function hrefWith(value: string | undefined) {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_PROPERTY_APP_URL', value);
  const { notificationHref } = await import('./notifications');
  return notificationHref;
}

describe('notificationHref', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('opens Employee Benefits cases in this app', async () => {
    const href = await hrefWith(undefined);
    expect(href(notification('ghi_case', 'GMC-2026-0001'))).toBe(`/ghi/${ID}`);
    expect(href(notification('eb_case', 'GPA-2026-0001'))).toBe(`/eb/gpa/${ID}`);
    expect(href(notification('eb_case', 'GTLI-2026-0001'))).toBe(`/eb/gtli/${ID}`);
  });

  it('opens a Property proposal in the Property app when its URL is set', async () => {
    const href = await hrefWith('https://property.example.com/');
    expect(href(notification('proposal', 'PRP-2026-0001'))).toBe(
      `https://property.example.com/proposals/${ID}`,
    );
  });

  it('gives a Property proposal no link when the URL is unset or not http(s)', async () => {
    expect((await hrefWith(undefined))(notification('proposal', null))).toBeNull();
    expect((await hrefWith('javascript:alert(1)'))(notification('proposal', null))).toBeNull();
    expect((await hrefWith('not a url'))(notification('proposal', null))).toBeNull();
  });
});
