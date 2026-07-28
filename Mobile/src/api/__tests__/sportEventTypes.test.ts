import { fetchSportEventTypeMap } from '../sportEventTypes';
import { api } from '../client';

jest.mock('../client', () => ({
  api: { get: jest.fn() },
}));

const mockApi = api as jest.Mocked<typeof api>;

describe('fetchSportEventTypeMap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls GET /api/sport-event-types', async () => {
    (mockApi.get as jest.Mock).mockResolvedValue({ data: [] });

    await fetchSportEventTypeMap();

    expect(mockApi.get).toHaveBeenCalledWith('/api/sport-event-types');
  });

  it('returns a map of event type id to name', async () => {
    (mockApi.get as jest.Mock).mockResolvedValue({
      data: [
        { id: 1, name: 'Entrenamiento' },
        { id: 2, name: 'Partido' },
      ],
    });

    const map = await fetchSportEventTypeMap();

    expect(map).toEqual({ 1: 'Entrenamiento', 2: 'Partido' });
  });

  it('returns an empty map when the request fails', async () => {
    (mockApi.get as jest.Mock).mockRejectedValue(new Error('network error'));

    const map = await fetchSportEventTypeMap();

    expect(map).toEqual({});
  });
});
