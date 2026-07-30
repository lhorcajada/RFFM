import { getTeamPlayerSanctions, type SanctionRecord } from '../sanctions';
import { api } from '../client';

jest.mock('../client', () => ({
  api: { get: jest.fn() },
}));

const mockApi = api as jest.Mocked<typeof api>;

describe('getTeamPlayerSanctions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls GET /api/catalog/teamplayer/{id}/sanctions with Competition category', async () => {
    (mockApi.get as jest.Mock).mockResolvedValue({
      data: [],
    });

    await getTeamPlayerSanctions('player1', 'Competition');

    expect(mockApi.get).toHaveBeenCalledWith('/api/catalog/teamplayer/player1/sanctions', {
      params: { category: 'Competition' },
    });
  });

  it('calls GET /api/catalog/teamplayer/{id}/sanctions with InternalDiscipline category', async () => {
    (mockApi.get as jest.Mock).mockResolvedValue({
      data: [],
    });

    await getTeamPlayerSanctions('player1', 'InternalDiscipline');

    expect(mockApi.get).toHaveBeenCalledWith('/api/catalog/teamplayer/player1/sanctions', {
      params: { category: 'InternalDiscipline' },
    });
  });

  it('returns an array of SanctionRecord', async () => {
    const mockData: SanctionRecord[] = [
      {
        id: 'sanction1',
        category: 'Competition',
        startDate: '2025-01-10',
        sanctionType: 'Expulsión',
        description: 'Tarjeta roja',
        estimatedEnd: '2025-01-24',
        endDate: null,
      },
      {
        id: 'sanction2',
        category: 'InternalDiscipline',
        startDate: '2024-12-05',
        sanctionType: 'Multa',
        description: null,
        estimatedEnd: null,
        endDate: '2024-12-10',
      },
    ];

    (mockApi.get as jest.Mock).mockResolvedValue({
      data: mockData,
    });

    const result = await getTeamPlayerSanctions('player1', 'Competition');

    expect(result).toEqual(mockData);
  });

  it('returns an empty array when response data is empty', async () => {
    (mockApi.get as jest.Mock).mockResolvedValue({
      data: [],
    });

    const result = await getTeamPlayerSanctions('player1', 'Competition');

    expect(result).toEqual([]);
  });

  it('throws error when the request fails', async () => {
    const error = new Error('network error');
    (mockApi.get as jest.Mock).mockRejectedValue(error);

    await expect(getTeamPlayerSanctions('player1', 'Competition')).rejects.toThrow('network error');
  });
});
