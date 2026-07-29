import { api } from './client';

export interface TeamSummary {
  name: string;
  shieldUrl: string | null;
  clubId: string | null;
  clubName: string | null;
  clubShieldUrl: string | null;
}

export const fetchTeamSummary = async (teamId: string): Promise<TeamSummary | null> => {
  try {
    const response = await api.get(`/api/catalog/team/${teamId}`);
    const data = response.data;
    return {
      name: data.name,
      shieldUrl: data.club?.emblemUrl ?? null,
      clubId: data.club?.id ?? null,
      clubName: data.club?.name ?? null,
      clubShieldUrl: data.club?.emblemUrl ?? null,
    };
  } catch {
    return null;
  }
};
