import { fetchClubEmblemDataUri } from '../clubEmblem';
import { api } from '../client';

jest.mock('../client', () => ({
  api: { get: jest.fn() },
}));

const mockApi = api as jest.Mocked<typeof api>;

describe('fetchClubEmblemDataUri', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requests the club emblem binary as an arraybuffer', async () => {
    const bytes = new Uint8Array([1, 2, 3]).buffer;
    (mockApi.get as jest.Mock).mockResolvedValue({
      data: bytes,
      headers: { 'content-type': 'image/png' },
    });

    await fetchClubEmblemDataUri('club1');

    expect(mockApi.get).toHaveBeenCalledWith('/api/catalog/club/club1/emblem', {
      responseType: 'arraybuffer',
    });
  });

  it('returns a base64 data URI built from the response bytes and content type', async () => {
    const bytes = new Uint8Array([72, 105]).buffer; // "Hi"
    (mockApi.get as jest.Mock).mockResolvedValue({
      data: bytes,
      headers: { 'content-type': 'image/png' },
    });

    const dataUri = await fetchClubEmblemDataUri('club1');

    expect(dataUri).toBe('data:image/png;base64,SGk=');
  });

  it('defaults to image/png when no content-type header is present', async () => {
    const bytes = new Uint8Array([72, 105]).buffer;
    (mockApi.get as jest.Mock).mockResolvedValue({ data: bytes, headers: {} });

    const dataUri = await fetchClubEmblemDataUri('club1');

    expect(dataUri).toBe('data:image/png;base64,SGk=');
  });

  it('returns null when the request fails', async () => {
    (mockApi.get as jest.Mock).mockRejectedValue(new Error('network error'));

    const dataUri = await fetchClubEmblemDataUri('club1');

    expect(dataUri).toBeNull();
  });
});
