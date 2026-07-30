import { api } from './client';

export interface SanctionRecord {
  id: string;
  category: 'Competition' | 'InternalDiscipline';
  startDate: string;
  sanctionType: string;
  description?: string | null;
  estimatedEnd?: string | null;
  endDate?: string | null;
}

export const getTeamPlayerSanctions = async (
  teamPlayerId: string,
  category: 'Competition' | 'InternalDiscipline'
): Promise<SanctionRecord[]> => {
  const response = await api.get(`/api/catalog/teamplayer/${teamPlayerId}/sanctions`, {
    params: { category },
  });
  return (response.data || []) as SanctionRecord[];
};
