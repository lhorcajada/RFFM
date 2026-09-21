import { client } from "../../../../core/api/client";

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
}

export const competitionService = new CompetitionService();
