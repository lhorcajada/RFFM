import client from "../../../core/api/client";

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

export async function searchNotifications(
  pageNumber: number,
  pageSize: number
): Promise<NotificationSearchResult> {
  const response = await client.get("/api/notifications", {
    params: { pageNumber, pageSize },
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
