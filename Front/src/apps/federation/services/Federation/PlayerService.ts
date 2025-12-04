import { client } from "../../../../core/api/client";

export class PlayerService {
  async getPlayer(playerId: string) {
    const res = await client.get(`players/${encodeURIComponent(playerId)}`);
    return res.data;
  }
}

export const playerService = new PlayerService();
