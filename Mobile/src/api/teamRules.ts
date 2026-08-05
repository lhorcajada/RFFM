import { api } from './client';

export interface TeamRule {
  id: string;
  order: number;
  shortTitle: string;
  highlight?: string | null;
  violationSummary: string;
  consequenceSummary: string;
  longDescription?: string | null;
  bulletPoints?: string[] | null;
  consequenceDetail?: string | null;
}

export interface TeamRules {
  teamId: string;
  title: string;
  subtitle: string;
  introNote: string;
  closingNote?: string | null;
  applicationNote?: string | null;
  rules: TeamRule[];
  updatedAt: string;
}

export interface SaveTeamRuleInput {
  id?: string;
  shortTitle: string;
  highlight?: string | null;
  violationSummary: string;
  consequenceSummary: string;
  longDescription?: string | null;
  bulletPoints?: string[] | null;
  consequenceDetail?: string | null;
}

export interface SaveTeamRulesInput {
  title: string;
  subtitle: string;
  introNote: string;
  closingNote?: string | null;
  applicationNote?: string | null;
  rules: SaveTeamRuleInput[];
}

export const getTeamRules = async (teamId: string): Promise<TeamRules | null> => {
  const response = await api.get(`/api/mobile/teams/${teamId}/rules`, {
    validateStatus: (status) => status === 200 || status === 204,
  });

  if (response.status === 204) {
    return null;
  }

  return response.data as TeamRules;
};

export const saveTeamRules = async (teamId: string, input: SaveTeamRulesInput): Promise<TeamRules> => {
  const response = await api.put(`/api/mobile/teams/${teamId}/rules`, input);
  return response.data as TeamRules;
};

export const deleteTeamRules = async (teamId: string): Promise<void> => {
  await api.delete(`/api/mobile/teams/${teamId}/rules`);
};
