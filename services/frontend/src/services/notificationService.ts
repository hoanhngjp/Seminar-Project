import { apiClient } from './api';
import type { ApiResponse } from '../types/api';
import type { Notification } from '../types/domain';

export async function fetchUnreadNotifications(limit = 10, cursor?: string): Promise<{
  items: Notification[];
  nextCursor: string | null;
  hasMore: boolean;
  totalUnread: number;
}> {
  const params: Record<string, string | number> = { limit };
  if (cursor) params['cursor'] = cursor;

  const res = await apiClient.get<ApiResponse<{ items: Notification[]; hasMore: boolean; totalUnread?: number }>>(
    '/api/v1/notifications/unread',
    { params },
  );
  const payload = res.data.data;
  const meta    = res.data.meta;
  return {
    items:       payload?.items      ?? [],
    nextCursor:  meta.pagination?.nextCursor ?? null,
    hasMore:     payload?.hasMore    ?? meta.pagination?.hasMore ?? false,
    totalUnread: payload?.totalUnread ?? payload?.items.filter((n) => !n.read).length ?? 0,
  };
}

export async function markNotificationRead(id: string, idempotencyKey: string): Promise<void> {
  await apiClient.patch(
    `/api/v1/notifications/${id}/read`,
    {},
    { headers: { 'Idempotency-Key': idempotencyKey } },
  );
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiClient.patch('/api/v1/notifications/read-all', {});
}
