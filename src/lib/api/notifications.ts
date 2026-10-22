import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { propertyAppUrl } from '@/lib/app-links';
import { buildSampleNotifications } from '@/lib/data/notifications';
import { isDemoModeError } from '@/lib/demo-mode';
import { queryKeys } from '@/lib/query-keys';
import {
  MarkReadResponseSchema,
  NotificationListResponseSchema,
  type Notification,
} from '@/shared';
import type { AppNotification } from '@/types/notification';

// A4: the signed-in user's in-app notifications, from the real API. In demo mode (the BFF runs
// without a backend) the sample notifications are shown instead, clearly labelled in the UI.

/** How many notifications the bell loads at once (bounded; the feed is cursor-paginated). */
const PAGE_LIMIT = 20;

export interface NotificationView {
  id: string;
  title: string;
  description: string;
  at: string;
  unread: boolean;
  /** The in-app path to open when the notification is clicked, or null when none applies. */
  href: string | null;
}

/**
 * Where a notification opens. GHI/EB → the case by its reference prefix; Property → the case in
 * the Property app, when its URL is configured.
 */
export function notificationHref(notification: Notification): string | null {
  if (notification.entity === 'proposal')
    return propertyAppUrl(`/proposals/${notification.entityId}`);
  if (notification.entity === 'ghi_case') return `/ghi/${notification.entityId}`;
  if (notification.entity === 'eb_case') {
    // The reference prefix tells GPA from GTLI (GPA-…, GTLI-…); fall back to the GPA workspace.
    const product = notification.reference?.startsWith('GTLI') ? 'gtli' : 'gpa';
    return `/eb/${product}/${notification.entityId}`;
  }
  return null;
}

function toView(notification: Notification): NotificationView {
  return {
    id: notification.id,
    title: notification.title,
    description: notification.reference
      ? `${notification.message} · ${notification.reference}`
      : notification.message,
    at: notification.createdAt,
    unread: !notification.read,
    href: notificationHref(notification),
  };
}

/** Sample notifications mapped to the view, for demo mode. */
function sampleViews(): NotificationView[] {
  return buildSampleNotifications(new Date()).map((item: AppNotification) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    at: item.at,
    unread: item.unread,
    href: propertyAppUrl(`/proposals/${item.proposalId}`),
  }));
}

export interface NotificationsResult {
  items: NotificationView[];
  unreadCount: number;
  /** True when the list is demo sample data, so the UI can say so. */
  sample: boolean;
}

export async function listNotifications(): Promise<NotificationsResult> {
  try {
    const response = await apiFetch(`notifications?limit=${PAGE_LIMIT}`, {
      schema: NotificationListResponseSchema,
    });
    return {
      items: response.items.map(toView),
      unreadCount: response.unreadCount,
      sample: false,
    };
  } catch (error) {
    if (isDemoModeError(error)) {
      const items = sampleViews();
      return { items, unreadCount: items.filter((item) => item.unread).length, sample: true };
    }
    throw error;
  }
}

export function useNotifications() {
  return useQuery({
    queryKey: queryKeys.notifications,
    queryFn: listNotifications,
    // Poll so the bell stays current without websockets; cheap bounded query.
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`notifications/${id}/read`, { method: 'POST', schema: MarkReadResponseSchema }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch('notifications/read-all', { method: 'POST', schema: MarkReadResponseSchema }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
    },
  });
}
