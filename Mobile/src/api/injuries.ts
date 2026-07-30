import { api } from './client';

export interface InjuryRecord {
  id: string;
  startDate: string;
  injuryType: string;
  description?: string | null;
  estimatedRecovery?: string | null;
  endDate?: string | null;
}

export const getTeamPlayerInjuries = async (teamPlayerId: string): Promise<InjuryRecord[]> => {
  const response = await api.get(`/api/catalog/teamplayer/${teamPlayerId}/injuries`);
  return (response.data || []) as InjuryRecord[];
};
