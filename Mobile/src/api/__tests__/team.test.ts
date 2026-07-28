import { fetchTeamSummary } from '../team';
import { api } from '../client';

jest.mock('../client', () => ({
  api: { get: jest.fn() },
}));

const mockApi = api as jest.Mocked<typeof api>;

describe('fetchTeamSummary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls GET /api/catalog/team/{teamId}', async () => {
    (mockApi.get as jest.Mock).mockResolvedValue({
      data: { id: 'team1', name: 'Alevin A', club: { emblemUrl: 'https://example.com/shield.png' } },
    });

    await fetchTeamSummary('team1');

    expect(mockApi.get).toHaveBeenCalledWith('/api/catalog/team/team1');
  });

  it('returns the team name, shield url, club name and club shield url', async () => {
    (mockApi.get as jest.Mock).mockResolvedValue({
      data: {
        id: 'team1',
        name: 'Alevin A',
        club: { id: 'club1', name: 'FC Example', emblemUrl: 'https://example.com/shield.png' },
      },
    });

    const summary = await fetchTeamSummary('team1');

    expect(summary).toEqual({
      name: 'Alevin A',
      shieldUrl: 'https://example.com/shield.png',
      clubId: 'club1',
      clubName: 'FC Example',
      clubShieldUrl: 'https://example.com/shield.png',
    });
  });

  it('returns null when the request fails', async () => {
    (mockApi.get as jest.Mock).mockRejectedValue(new Error('network error'));

    const summary = await fetchTeamSummary('team1');

    expect(summary).toBeNull();
  });
});
