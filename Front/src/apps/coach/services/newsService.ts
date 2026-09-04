import client from "../../../core/api/client";

export type NewsStatusValue = "Draft" | "Published";

export type NewsSummaryDto = {
  id: string;
  title: string;
  subtitle: string;
  coverImageUrl: string;
  status: NewsStatusValue;
  publishedAt: string | null;
  newsDate: string;
  linkType: "None" | "MatchConvocation" | "External";
  linkedEventId: string | null;
  linkedTeamId: string | null;
  linkUrl: string | null;
};

export type NewsDetailDto = NewsSummaryDto & {
  body: string;
  createdAt: string;
  updatedAt: string;
};

export type NewsPayload = {
  title: string;
  subtitle: string;
  body: string;
  coverImageUrl: string;
  newsDate: string;
  linkType: "None" | "MatchConvocation" | "External";
  linkedEventId: string | null;
  linkedTeamId: string | null;
  linkUrl: string | null;
};

export async function getNews(
  pageNumber = 1,
  pageSize = 20,
  descending = false
): Promise<NewsSummaryDto[]> {
  const resp = await client.get<NewsSummaryDto[]>("/api/coach/news", {
    params: { pageNumber, pageSize, descending },
  });
  return resp.data ?? [];
}

export async function getNewsDrafts(
  pageNumber = 1,
  pageSize = 20
): Promise<NewsSummaryDto[]> {
  const resp = await client.get<NewsSummaryDto[]>("/api/coach/news/drafts", {
    params: { pageNumber, pageSize },
  });
  return resp.data ?? [];
}

export async function getNewsById(id: string): Promise<NewsDetailDto | null> {
  try {
    const resp = await client.get<NewsDetailDto>(`/api/coach/news/${id}`);
    return resp.data ?? null;
  } catch {
    return null;
  }
}

export async function createNews(
  payload: NewsPayload & { status: NewsStatusValue }
): Promise<{ id: string }> {
  const resp = await client.post<{ id: string }>("/api/coach/news", {
    Title: payload.title,
    Subtitle: payload.subtitle,
    Body: payload.body,
    CoverImageUrl: payload.coverImageUrl,
    Status: payload.status,
    NewsDate: payload.newsDate,
    LinkType: payload.linkType,
    LinkedEventId: payload.linkedEventId,
    LinkedTeamId: payload.linkedTeamId,
    LinkUrl: payload.linkUrl,
  });
  return resp.data;
}

export async function updateNews(id: string, payload: NewsPayload): Promise<void> {
  await client.put(`/api/coach/news/${id}`, {
    Title: payload.title,
    Subtitle: payload.subtitle,
    Body: payload.body,
    CoverImageUrl: payload.coverImageUrl,
    NewsDate: payload.newsDate,
    LinkType: payload.linkType,
    LinkedEventId: payload.linkedEventId,
    LinkedTeamId: payload.linkedTeamId,
    LinkUrl: payload.linkUrl,
  });
}

export async function deleteNews(id: string): Promise<void> {
  await client.delete(`/api/coach/news/${id}`);
}

export async function publishNews(id: string): Promise<NewsDetailDto> {
  const resp = await client.post<NewsDetailDto>(`/api/coach/news/${id}/publish`);
  return resp.data;
}

export async function unpublishNews(id: string): Promise<NewsDetailDto> {
  const resp = await client.post<NewsDetailDto>(`/api/coach/news/${id}/unpublish`);
  return resp.data;
}

export async function uploadNewsImage(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const resp = await client.post<{ url?: string; Url?: string }>(
    "/api/coach/news/image",
    form,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return resp.data.url ?? resp.data.Url ?? "";
}

export default {
  getNews, getNewsDrafts, getNewsById, createNews, updateNews, deleteNews,
  publishNews, unpublishNews, uploadNewsImage,
};
