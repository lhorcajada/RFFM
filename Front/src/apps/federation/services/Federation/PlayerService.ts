import { client } from "../../../../core/api/client";

type PlayerGetParams = { seasonId?: string };

export class PlayerService {
  async getPlayer(
    playerId: string,
    params?: PlayerGetParams,
  ): Promise<unknown> {
    const q = new URLSearchParams();
    if (params?.seasonId) q.append("seasonId", params.seasonId);
    const qs = q.toString() ? `?${q.toString()}` : "";

    const res = await client.get(
      `players/${encodeURIComponent(playerId)}${qs}`,
    );
    const data: unknown = res.data;

    // Some backends wrap payload under { player: ... }.
    if (data && typeof data === "object") {
      const rec = data as Record<string, unknown>;
      if (rec.player != null) return rec.player;
    }

    return data;
  }
}

export const playerService = new PlayerService();
