import { client } from "../../../../core/api/client";

export class CompetitionService {
  async getCompetitions() {
    const res = await client.get("competitions");
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
