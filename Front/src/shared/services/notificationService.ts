import client from "../../core/api/client";

export const NOTIFICATIONS_CHANGED_EVENT = "rffm.notifications_changed";

export type NotificationApp = "federation" | "coach";

export type NotificationResponse = {
  id: string;
  type: string;
  title: string;
  body: string;
  deepLinkPath: string | null;
  isRead: boolean;
  createdAt: string;
};

export type NotificationSearchResult = {
  items: NotificationResponse[];
  totalCount: number;
};

type MarkAllNotificationsReadResponse = {
  marked: number;
};

type DeleteNotificationsResponse = {
  deleted: number;
};

export async function searchNotifications(
  pageNumber: number,
  pageSize: number,
  options: { suppressErrorRedirect?: boolean; app?: NotificationApp } = {}
): Promise<NotificationSearchResult> {
  const response = await client.get("/api/notifications", {
    params: options.app ? { pageNumber, pageSize, app: options.app } : { pageNumber, pageSize },
    suppressErrorRedirect: options.suppressErrorRedirect ?? false,
  });

  const totalCount = parseInt(response.headers["x-total-count"] ?? "0", 10) || 0;

  return {
    items: response.data,
    totalCount,
  };
}

export async function markNotificationRead(id: string): Promise<void> {
  await client.post(`/api/notifications/${id}/read`);
}

export async function markAllNotificationsRead(app: NotificationApp): Promise<number> {
  const response = await client.post<MarkAllNotificationsReadResponse>("/api/notifications/read", null, {
    params: { app },
  });
  return response.data?.marked ?? 0;
}

export async function deleteNotifications(ids: string[]): Promise<number> {
  const response = await client.delete<DeleteNotificationsResponse>("/api/notifications", {
    data: { ids },
  });
  return response.data?.deleted ?? 0;
}

export async function deleteAllNotifications(app: NotificationApp): Promise<number> {
  const response = await client.delete<DeleteNotificationsResponse>("/api/notifications/all", {
    params: { app },
  });
  return response.data?.deleted ?? 0;
}
