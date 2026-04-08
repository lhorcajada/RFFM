import client from "../../../core/api/client";
import type { PlayerRating } from "../types/playerRating";

export async function getRatingHistory(teamPlayerId: string): Promise<PlayerRating[]> {
  const resp = await client.get(`/api/catalog/teamplayer/${teamPlayerId}/ratings`);
  return resp.data as PlayerRating[];
}

export async function getTeamLatestRatings(teamId: string): Promise<PlayerRating[]> {
  const resp = await client.get(`/api/catalog/team/${teamId}/ratings/latest`);
  return resp.data as PlayerRating[];
}

export async function createRating(
  teamPlayerId: string,
  payload: {
    technical: number;
    tactical: number;
    physical: number;
    competitiveness: number;
    notes?: string | null;
  }
): Promise<PlayerRating> {
  const resp = await client.post(`/api/catalog/teamplayer/${teamPlayerId}/ratings`, payload);
  return resp.data as PlayerRating;
}

const playerRatingService = { getRatingHistory, getTeamLatestRatings, createRating };
export default playerRatingService;
