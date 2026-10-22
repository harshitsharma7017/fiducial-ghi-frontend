import type { AppNotification } from '@/types/notification';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Sample notifications (fictional companies and insurers), timed relative to `now`, so they are
 * never in the future. Imported only by src/lib/api and tests.
 */
export function buildSampleNotifications(now: Date): AppNotification[] {
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
  return [
    {
      id: 'ntf-renewal-0107',
      kind: 'RENEWAL_DUE',
      title: 'Renewal due in 12 days',
      description: 'Kesar Valley Spices LLP · PRP-2026-0107',
      proposalId: 'prp-0107',
      at: ago(25 * MINUTE),
      unread: true,
    },
    {
      id: 'ntf-quote-0104',
      kind: 'QUOTE_RECEIVED',
      title: 'Quote received',
      description: 'Kavach General Insurance quoted for Vasundhara Polymers Ltd · PRP-2026-0104',
      proposalId: 'prp-0104',
      at: ago(2 * HOUR + 10 * MINUTE),
      unread: true,
    },
    {
      id: 'ntf-qcr-0105',
      kind: 'QCR_READY',
      title: 'QCR ready for review',
      description: 'Suryodaya Solar Components Pvt Ltd · PRP-2026-0105',
      proposalId: 'prp-0105',
      at: ago(DAY + 3 * HOUR),
      unread: true,
    },
    {
      id: 'ntf-declined-0108',
      kind: 'INSURER_DECLINED',
      title: 'Insurer declined',
      description:
        'Abhay General Insurance declined Lohgarh Steel Fabricators Pvt Ltd · PRP-2026-0108',
      proposalId: 'prp-0108',
      at: ago(3 * DAY),
      unread: false,
    },
  ];
}
