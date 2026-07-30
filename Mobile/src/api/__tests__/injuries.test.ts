import { getTeamPlayerInjuries, type InjuryRecord } from '../injuries';
import { api } from '../client';

jest.mock('../client', () => ({
  api: { get: jest.fn() },
}));

const mockApi = api as jest.Mocked<typeof api>;

describe('getTeamPlayerInjuries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls GET /api/catalog/teamplayer/{id}/injuries', async () => {
    (mockApi.get as jest.Mock).mockResolvedValue({
      data: [],
    });

    await getTeamPlayerInjuries('player1');

    expect(mockApi.get).toHaveBeenCalledWith('/api/catalog/teamplayer/player1/injuries');
  });

  it('returns an array of InjuryRecord', async () => {
    const mockData: InjuryRecord[] = [
      {
        id: 'injury1',
        startDate: '2025-01-15',
        injuryType: 'Fractura',
        description: 'Fractura de tibia',
        estimatedRecovery: '4 semanas',
        endDate: null,
      },
      {
        id: 'injury2',
        startDate: '2024-12-01',
        injuryType: 'Esguince',
        description: null,
        estimatedRecovery: null,
        endDate: '2024-12-20',
      },
    ];

    (mockApi.get as jest.Mock).mockResolvedValue({
      data: mockData,
    });

    const result = await getTeamPlayerInjuries('player1');

    expect(result).toEqual(mockData);
  });

  it('returns an empty array when response data is empty', async () => {
    (mockApi.get as jest.Mock).mockResolvedValue({
      data: [],
    });

    const result = await getTeamPlayerInjuries('player1');

    expect(result).toEqual([]);
  });

  it('throws error when the request fails', async () => {
    const error = new Error('network error');
    (mockApi.get as jest.Mock).mockRejectedValue(error);

    await expect(getTeamPlayerInjuries('player1')).rejects.toThrow('network error');
  });
});
