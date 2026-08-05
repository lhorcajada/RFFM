import { api } from '../client';
import { getTeamRules, saveTeamRules, deleteTeamRules } from '../teamRules';

jest.mock('../client', () => ({
  api: { get: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

const mockApi = api as jest.Mocked<typeof api>;

const teamRulesResponse = {
  teamId: 'team1',
  title: 'NORMAS DE EQUIPO',
  subtitle: 'Compromiso, respeto y equipo',
  introNote: 'Nota inicial...',
  closingNote: 'Nota sobre aportaciones...',
  applicationNote: 'El incumplimiento...',
  rules: [
    {
      id: 'rule1',
      order: 1,
      shortTitle: 'Asistencia y preparación',
      highlight: 'Entrenar suma preparación...',
      violationSummary: 'No entrenar...',
      consequenceSummary: 'Podrá afectar...',
      longDescription: 'El equipo entrena dos días...',
      bulletPoints: ['Asistencia semanal...'],
      consequenceDetail: null,
    },
  ],
  updatedAt: '2026-08-05T10:00:00Z',
};

describe('teamRules api client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getTeamRules', () => {
    it('returns null when the backend responds with 204 (no rules set yet)', async () => {
      (mockApi.get as jest.Mock).mockResolvedValue({ status: 204, data: null });

      const result = await getTeamRules('team1');

      expect(result).toBeNull();
      expect(mockApi.get).toHaveBeenCalledWith(
        '/api/mobile/teams/team1/rules',
        expect.objectContaining({ validateStatus: expect.any(Function) }),
      );
    });

    it('returns the structured rules payload when the backend responds with 200', async () => {
      (mockApi.get as jest.Mock).mockResolvedValue({ status: 200, data: teamRulesResponse });

      const result = await getTeamRules('team1');

      expect(result).toEqual(teamRulesResponse);
    });

    it('propagates errors from the API call', async () => {
      (mockApi.get as jest.Mock).mockRejectedValue(new Error('network error'));

      await expect(getTeamRules('team1')).rejects.toThrow('network error');
    });
  });

  describe('saveTeamRules', () => {
    it('puts the full rules payload and returns the saved result', async () => {
      const input = {
        title: 'NORMAS DE EQUIPO',
        subtitle: 'Compromiso, respeto y equipo',
        introNote: 'Nota inicial...',
        closingNote: null,
        applicationNote: null,
        rules: [
          {
            shortTitle: 'Asistencia y preparación',
            violationSummary: 'No entrenar...',
            consequenceSummary: 'Podrá afectar...',
          },
        ],
      };
      (mockApi.put as jest.Mock).mockResolvedValue({ data: teamRulesResponse });

      const result = await saveTeamRules('team1', input as any);

      expect(mockApi.put).toHaveBeenCalledWith('/api/mobile/teams/team1/rules', input);
      expect(result).toEqual(teamRulesResponse);
    });

    it('propagates errors from the save request', async () => {
      (mockApi.put as jest.Mock).mockRejectedValue(new Error('save failed'));

      await expect(saveTeamRules('team1', {} as any)).rejects.toThrow('save failed');
    });
  });

  describe('deleteTeamRules', () => {
    it('deletes the rules set for the team', async () => {
      (mockApi.delete as jest.Mock).mockResolvedValue({ status: 204 });

      await deleteTeamRules('team1');

      expect(mockApi.delete).toHaveBeenCalledWith('/api/mobile/teams/team1/rules');
    });

    it('propagates errors from the delete request', async () => {
      (mockApi.delete as jest.Mock).mockRejectedValue(new Error('delete failed'));

      await expect(deleteTeamRules('team1')).rejects.toThrow('delete failed');
    });
  });
});
