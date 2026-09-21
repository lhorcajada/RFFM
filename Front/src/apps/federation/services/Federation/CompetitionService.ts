import { client } from "../../../../core/api/client";

export type CompetitionTeamMatch = {
  teamCode: string;
  teamName: string;
  groupCode: string;
  groupName: string;
  competitionCode: string;
  competitionName: string;
};

export class CompetitionService {
  async getCompetitions(season?: number | null) {
    const res = await client.get("competitions", {
      params: season != null ? { season } : undefined,
    });
    return res.data;
  }

  async getGroups(competitionId?: string) {
    const q = competitionId
      ? `?competitionId=${encodeURIComponent(competitionId)}`
      : "";
    const res = await client.get(`groups${q}`);
    return res.data;
  }

  async searchTeams(
    competitionId: string,
    name: string,
    season?: number | null,
  ): Promise<CompetitionTeamMatch[]> {
    const res = await client.get(
      `competitions/${encodeURIComponent(competitionId)}/teams`,
      { params: { name, season: season ?? undefined } },
    );
    return res.data as CompetitionTeamMatch[];
  }
}

export const competitionService = new CompetitionService();
