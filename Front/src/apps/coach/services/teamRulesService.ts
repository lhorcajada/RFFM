import client from "../../../core/api/client";

export type TeamRuleDto = {
  id: string;
  order: number;
  shortTitle: string;
  highlight: string | null;
  violationSummary: string;
  consequenceSummary: string;
  longDescription: string | null;
  bulletPoints: string[] | null;
  consequenceDetail: string | null;
};

export type TeamRulesDto = {
  teamId: string;
  title: string;
  subtitle: string;
  introNote: string;
  closingNote: string | null;
  applicationNote: string | null;
  rules: TeamRuleDto[];
  updatedAt: string;
};

export type SaveTeamRuleRequest = {
  id?: string | null;
  shortTitle: string;
  highlight?: string | null;
  violationSummary: string;
  consequenceSummary: string;
  longDescription?: string | null;
  bulletPoints?: string[] | null;
  consequenceDetail?: string | null;
};

export type SaveTeamRulesCommand = {
  title: string;
  subtitle: string;
  introNote: string;
  closingNote?: string | null;
  applicationNote?: string | null;
  rules: SaveTeamRuleRequest[];
};

const baseUrl = (teamId: string) => `/api/coaches/teams/${teamId}/rules`;

const getTeamRules = async (teamId: string): Promise<TeamRulesDto | null> => {
  const response = await client.get<TeamRulesDto>(baseUrl(teamId));
  if (response.status === 204) return null;
  return response.data;
};

const saveTeamRules = async (
  teamId: string,
  command: SaveTeamRulesCommand
): Promise<TeamRulesDto> => {
  const { data } = await client.put<TeamRulesDto>(baseUrl(teamId), command);
  return data;
};

const deleteTeamRules = async (teamId: string): Promise<void> => {
  await client.delete(baseUrl(teamId));
};

export default {
  getTeamRules,
  saveTeamRules,
  deleteTeamRules,
};
