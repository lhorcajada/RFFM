import { fetchTeamClassification, fetchTeamCalendar, fetchTeamNextMatch } from '../competitions';
import { api } from '../client';

jest.mock('../client', () => ({
  api: { get: jest.fn() },
}));

const mockApi = api as jest.Mocked<typeof api>;

describe('competitions api', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchTeamClassification', () => {
    it('calls GET /api/mobile/teams/{teamId}/classification and returns the data', async () => {
      const data = { teams: [{ position: 1, teamId: 'team1', teamName: 'Equipo A', imageUrl: '', played: 1, won: 1, drawn: 0, lost: 0, goalsFor: 2, goalsAgainst: 0, points: 3 }] };
      (mockApi.get as jest.Mock).mockResolvedValue({ data });

      const result = await fetchTeamClassification('team1');

      expect(mockApi.get).toHaveBeenCalledWith('/api/mobile/teams/team1/classification');
      expect(result).toEqual(data);
    });

    it('propagates the error when the request fails', async () => {
      (mockApi.get as jest.Mock).mockRejectedValue(new Error('network error'));

      await expect(fetchTeamClassification('team1')).rejects.toThrow('network error');
    });
  });

  describe('fetchTeamCalendar', () => {
    it('calls GET /api/mobile/teams/{teamId}/calendar and returns the data', async () => {
      const data = { matchDays: [{ date: '2026-01-10T00:00:00', matchDayNumber: 1, matches: [] }] };
      (mockApi.get as jest.Mock).mockResolvedValue({ data });

      const result = await fetchTeamCalendar('team1');

      expect(mockApi.get).toHaveBeenCalledWith('/api/mobile/teams/team1/calendar');
      expect(result).toEqual(data);
    });

    it('propagates the error when the request fails', async () => {
      (mockApi.get as jest.Mock).mockRejectedValue(new Error('network error'));

      await expect(fetchTeamCalendar('team1')).rejects.toThrow('network error');
    });
  });

  describe('fetchTeamNextMatch', () => {
    it('calls GET /api/mobile/teams/{teamId}/next-match and returns the data', async () => {
      const data = { match: null };
      (mockApi.get as jest.Mock).mockResolvedValue({ data });

      const result = await fetchTeamNextMatch('team1');

      expect(mockApi.get).toHaveBeenCalledWith('/api/mobile/teams/team1/next-match');
      expect(result).toEqual(data);
    });

    it('propagates the error when the request fails', async () => {
      (mockApi.get as jest.Mock).mockRejectedValue(new Error('network error'));

      await expect(fetchTeamNextMatch('team1')).rejects.toThrow('network error');
    });
  });
});
