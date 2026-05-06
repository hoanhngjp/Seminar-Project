import { apiClient } from './client';

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  createdAt: string;
}

export interface UnreadNotificationsResponse {
  items: NotificationItem[];
  hasMore: boolean;
}

export async function fetchUnreadNotifications(limit = 10): Promise<UnreadNotificationsResponse> {
  const res = await apiClient.get<{ data: UnreadNotificationsResponse }>(
    '/api/v1/notifications/unread',
    { params: { limit } },
  );
  return res.data.data;
}

export async function markNotificationRead(id: string, idempotencyKey: string): Promise<void> {
  await apiClient.patch(
    `/api/v1/notifications/${id}/read`,
    {},
    { headers: { 'Idempotency-Key': idempotencyKey } },
  );
}
