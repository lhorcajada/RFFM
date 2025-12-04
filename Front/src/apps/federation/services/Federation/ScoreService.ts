import { client } from "../../../../core/api/client";
import type { Goleador } from "../../types/goleador";

export class ScoreService {
  async getGoleadores(
    competitionId: string,
    gropuId: string
  ): Promise<Goleador[]> {
    const res = await client.get(
      `scores?competitionId=${encodeURIComponent(
        competitionId
      )}&gropuId=${encodeURIComponent(gropuId)}`
    );
    return res.data as Goleador[];
  }
}

export const scoreService = new ScoreService();
