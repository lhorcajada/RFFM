import {
  getNews,
  getNewsDrafts,
  getNewsById,
  uploadNewsImage,
  createNews,
  updateNews,
  publishNews,
  deleteNews,
} from '../news';
import { api } from '../client';

jest.mock('../client', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockApi = api as jest.Mocked<typeof api>;

describe('getNews', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls api.get with pageNumber and pageSize params', async () => {
    mockApi.get.mockResolvedValue({
      data: [],
      headers: { 'x-total-count': '0' },
    });

    await getNews(1, 10);

    expect(mockApi.get).toHaveBeenCalledWith('/api/coach/news', {
      params: { pageNumber: 1, pageSize: 10 },
    });
  });

  it('returns items and parses totalCount from x-total-count header', async () => {
    const mockItems = [
      {
        id: 'news1',
        title: 'Title 1',
        subtitle: 'Subtitle 1',
        coverImageUrl: 'url1',
        status: 'Published',
        publishedAt: '2026-01-01T00:00:00Z',
        newsDate: '2026-01-05',
      },
    ];
    mockApi.get.mockResolvedValue({
      data: mockItems,
      headers: { 'x-total-count': '42' },
    });

    const result = await getNews(1, 10);

    expect(result).toEqual({ items: mockItems, totalCount: 42 });
  });

  it('defaults to totalCount 0 when x-total-count header is missing', async () => {
    mockApi.get.mockResolvedValue({
      data: [],
      headers: {},
    });

    const result = await getNews(1, 10);

    expect(result.totalCount).toBe(0);
  });

  it('propagates errors when the request fails', async () => {
    const error = new Error('network error');
    mockApi.get.mockRejectedValue(error);

    await expect(getNews(1, 10)).rejects.toThrow('network error');
  });
});

describe('getNewsDrafts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls api.get on /api/coach/news/drafts with params', async () => {
    mockApi.get.mockResolvedValue({
      data: [],
      headers: { 'x-total-count': '0' },
    });

    await getNewsDrafts(1, 10);

    expect(mockApi.get).toHaveBeenCalledWith('/api/coach/news/drafts', {
      params: { pageNumber: 1, pageSize: 10 },
    });
  });

  it('returns items and parses totalCount from header', async () => {
    const mockItems = [
      {
        id: 'draft1',
        title: 'Draft Title',
        subtitle: 'Draft Subtitle',
        coverImageUrl: 'url',
        status: 'Draft',
        publishedAt: null,
        newsDate: '2026-02-10',
      },
    ];
    mockApi.get.mockResolvedValue({
      data: mockItems,
      headers: { 'x-total-count': '5' },
    });

    const result = await getNewsDrafts(1, 10);

    expect(result).toEqual({ items: mockItems, totalCount: 5 });
  });

  it('propagates errors', async () => {
    mockApi.get.mockRejectedValue(new Error('forbidden'));

    await expect(getNewsDrafts(1, 10)).rejects.toThrow('forbidden');
  });
});

describe('getNewsById', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls api.get with the news id', async () => {
    const mockDetail = {
      id: 'news1',
      title: 'Title',
      subtitle: 'Subtitle',
      body: 'Body',
      coverImageUrl: 'url',
      status: 'Published',
      publishedAt: '2026-01-01T00:00:00Z',
      newsDate: '2026-01-05',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };
    mockApi.get.mockResolvedValue({ data: mockDetail });

    await getNewsById('news1');

    expect(mockApi.get).toHaveBeenCalledWith('/api/coach/news/news1');
  });

  it('returns response.data as NewsDetail', async () => {
    const mockDetail = {
      id: 'news1',
      title: 'Title',
      subtitle: 'Subtitle',
      body: 'Body',
      coverImageUrl: 'url',
      status: 'Published',
      publishedAt: '2026-01-01T00:00:00Z',
      newsDate: '2026-01-05',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };
    mockApi.get.mockResolvedValue({ data: mockDetail });

    const result = await getNewsById('news1');

    expect(result).toEqual(mockDetail);
  });

  it('propagates errors', async () => {
    mockApi.get.mockRejectedValue(new Error('not found'));

    await expect(getNewsById('missing')).rejects.toThrow('not found');
  });
});

describe('uploadNewsImage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('posts to /api/coach/news/image with FormData and multipart header', async () => {
    mockApi.post.mockResolvedValue({
      data: { url: 'https://storage.example.com/image.jpg' },
    });

    await uploadNewsImage('file://local.jpg');

    expect(mockApi.post).toHaveBeenCalledWith(
      '/api/coach/news/image',
      expect.any(FormData),
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
  });

  it('returns url from response', async () => {
    mockApi.post.mockResolvedValue({
      data: { url: 'https://storage.example.com/image.jpg' },
    });

    const result = await uploadNewsImage('file://local.jpg');

    expect(result).toEqual({ url: 'https://storage.example.com/image.jpg' });
  });

  it('propagates errors', async () => {
    mockApi.post.mockRejectedValue(new Error('upload failed'));

    await expect(uploadNewsImage('file://local.jpg')).rejects.toThrow('upload failed');
  });
});

describe('createNews', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('posts to /api/coach/news with payload', async () => {
    mockApi.post.mockResolvedValue({
      data: { id: 'new-id' },
    });

    const payload = {
      title: 'Title',
      subtitle: 'Subtitle',
      body: 'Body',
      coverImageUrl: 'url',
      status: 'Draft' as const,
      newsDate: '2026-09-01',
    };

    await createNews(payload);

    expect(mockApi.post).toHaveBeenCalledWith('/api/coach/news', payload);
  });

  it('returns id from response', async () => {
    mockApi.post.mockResolvedValue({
      data: { id: 'new-id' },
    });

    const payload = {
      title: 'Title',
      subtitle: 'Subtitle',
      body: 'Body',
      coverImageUrl: 'url',
      status: 'Published' as const,
      newsDate: '2026-09-01',
    };

    const result = await createNews(payload);

    expect(result).toEqual({ id: 'new-id' });
  });

  it('propagates errors', async () => {
    mockApi.post.mockRejectedValue(new Error('validation error'));

    const payload = {
      title: 'Title',
      subtitle: 'Subtitle',
      body: 'Body',
      coverImageUrl: 'url',
      status: 'Draft' as const,
      newsDate: '2026-09-01',
    };

    await expect(createNews(payload)).rejects.toThrow('validation error');
  });
});

describe('updateNews', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('puts to /api/coach/news/{id} with payload', async () => {
    mockApi.put.mockResolvedValue({});

    const payload = {
      title: 'Updated',
      subtitle: 'Subtitle',
      body: 'Body',
      coverImageUrl: 'url',
      newsDate: '2026-09-01',
    };

    await updateNews('news1', payload);

    expect(mockApi.put).toHaveBeenCalledWith('/api/coach/news/news1', payload);
  });

  it('resolves to undefined', async () => {
    mockApi.put.mockResolvedValue({});

    const payload = {
      title: 'Updated',
      subtitle: 'Subtitle',
      body: 'Body',
      coverImageUrl: 'url',
      newsDate: '2026-09-01',
    };

    const result = await updateNews('news1', payload);

    expect(result).toBeUndefined();
  });

  it('propagates errors', async () => {
    mockApi.put.mockRejectedValue(new Error('not found'));

    const payload = {
      title: 'Updated',
      subtitle: 'Subtitle',
      body: 'Body',
      coverImageUrl: 'url',
      newsDate: '2026-09-01',
    };

    await expect(updateNews('missing', payload)).rejects.toThrow('not found');
  });
});

describe('publishNews', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('posts to /api/coach/news/{id}/publish', async () => {
    const mockDetail = {
      id: 'news1',
      title: 'Title',
      subtitle: 'Subtitle',
      body: 'Body',
      coverImageUrl: 'url',
      status: 'Published',
      publishedAt: '2026-01-01T00:00:00Z',
      newsDate: '2026-01-05',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };
    mockApi.post.mockResolvedValue({ data: mockDetail });

    await publishNews('news1');

    expect(mockApi.post).toHaveBeenCalledWith('/api/coach/news/news1/publish');
  });

  it('returns response.data as NewsDetail', async () => {
    const mockDetail = {
      id: 'news1',
      title: 'Title',
      subtitle: 'Subtitle',
      body: 'Body',
      coverImageUrl: 'url',
      status: 'Published',
      publishedAt: '2026-01-01T00:00:00Z',
      newsDate: '2026-01-05',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };
    mockApi.post.mockResolvedValue({ data: mockDetail });

    const result = await publishNews('news1');

    expect(result).toEqual(mockDetail);
  });

  it('propagates errors', async () => {
    mockApi.post.mockRejectedValue(new Error('conflict'));

    await expect(publishNews('news1')).rejects.toThrow('conflict');
  });
});

describe('deleteNews', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deletes /api/coach/news/{id}', async () => {
    mockApi.delete.mockResolvedValue({});

    await deleteNews('news1');

    expect(mockApi.delete).toHaveBeenCalledWith('/api/coach/news/news1');
  });

  it('resolves', async () => {
    mockApi.delete.mockResolvedValue({});

    const result = await deleteNews('news1');

    expect(result).toBeUndefined();
  });

  it('propagates errors', async () => {
    mockApi.delete.mockRejectedValue(new Error('forbidden'));

    await expect(deleteNews('news1')).rejects.toThrow('forbidden');
  });
});
