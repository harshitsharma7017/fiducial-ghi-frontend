import { z } from 'zod';

export const NOTIFICATION_KINDS = [
  'RENEWAL_DUE',
  'QUOTE_RECEIVED',
  'QCR_READY',
  'INSURER_DECLINED',
] as const;
export const NotificationKindSchema = z.enum(NOTIFICATION_KINDS);
export type NotificationKind = z.infer<typeof NotificationKindSchema>;

/** A sample notification about one proposal. Real notifications are out of scope. */
export const AppNotificationSchema = z.strictObject({
  id: z.string().min(1),
  kind: NotificationKindSchema,
  title: z.string().min(1),
  description: z.string().min(1),
  proposalId: z.string().min(1),
  at: z.iso.datetime(),
  unread: z.boolean(),
});
export type AppNotification = z.infer<typeof AppNotificationSchema>;
