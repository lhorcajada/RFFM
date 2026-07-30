import { api } from './client';

export interface NewsSummary {
  id: string;
  title: string;
  subtitle: string;
  coverImageUrl: string;
  status: 'Draft' | 'Published';
  publishedAt: string | null;
  newsDate: string;
}

export interface NewsDetail extends NewsSummary {
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface NewsListResult {
  items: NewsSummary[];
  totalCount: number;
}

export interface CreateNewsPayload {
  title: string;
  subtitle: string;
  body: string;
  coverImageUrl: string;
  status: 'Draft' | 'Published';
  newsDate: string;
}

export interface UpdateNewsPayload {
  title: string;
  subtitle: string;
  body: string;
  coverImageUrl: string;
  newsDate: string;
}

function parseTotalCount(headers: Record<string, any> | undefined): number {
  const raw = headers?.['x-total-count'];
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isNaN(parsed) ? 0 : parsed;
}

export const getNews = async (pageNumber: number, pageSize: number): Promise<NewsListResult> => {
  const response = await api.get('/api/coach/news', { params: { pageNumber, pageSize } });
  return { items: response.data as NewsSummary[], totalCount: parseTotalCount(response.headers) };
};

export const getNewsDrafts = async (pageNumber: number, pageSize: number): Promise<NewsListResult> => {
  const response = await api.get('/api/coach/news/drafts', { params: { pageNumber, pageSize } });
  return { items: response.data as NewsSummary[], totalCount: parseTotalCount(response.headers) };
};

export const getNewsById = async (id: string): Promise<NewsDetail> => {
  const response = await api.get(`/api/coach/news/${id}`);
  return response.data as NewsDetail;
};

export const uploadNewsImage = async (fileUri: string): Promise<{ url: string }> => {
  const fileName = fileUri.split('/').pop() || `cover-${Date.now()}.jpg`;
  const extensionMatch = /\.(\w+)$/.exec(fileName);
  const extension = extensionMatch ? extensionMatch[1].toLowerCase() : 'jpg';
  const mimeType = extension === 'png' ? 'image/png' : 'image/jpeg';

  const formData = new FormData();
  formData.append('file', {
    uri: fileUri,
    name: fileName,
    type: mimeType,
  } as any);

  const response = await api.post('/api/coach/news/image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return { url: response.data.url };
};

export const createNews = async (payload: CreateNewsPayload): Promise<{ id: string }> => {
  const response = await api.post('/api/coach/news', payload);
  return { id: response.data.id };
};

export const updateNews = async (id: string, payload: UpdateNewsPayload): Promise<void> => {
  await api.put(`/api/coach/news/${id}`, payload);
};

export const publishNews = async (id: string): Promise<NewsDetail> => {
  const response = await api.post(`/api/coach/news/${id}/publish`);
  return response.data as NewsDetail;
};

export const deleteNews = async (id: string): Promise<void> => {
  await api.delete(`/api/coach/news/${id}`);
};
