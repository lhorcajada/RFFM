import client from "../../../core/api/client";
import type { CategoryKey, PlayerRating } from "../types/playerRating";

export async function getRatingHistory(teamPlayerId: string): Promise<PlayerRating[]> {
  const resp = await client.get(`/api/catalog/teamplayer/${teamPlayerId}/ratings`);
  return resp.data as PlayerRating[];
}

export async function getTeamLatestRatings(teamId: string): Promise<PlayerRating[]> {
  const resp = await client.get(`/api/catalog/team/${teamId}/ratings/latest`);
  return resp.data as PlayerRating[];
}

export type CharacteristicAnswer = {
  characteristicKey: string;
  /** Level 1–10 */
  level: number;
  /** Descriptive concept text for this level */
  concept: string;
  categoryKey: CategoryKey;
};

export type CreateRatingPayload = {
  isGoalkeeper: boolean;
  answers: CharacteristicAnswer[];
  notes?: string | null;
};

export async function createRating(
  teamPlayerId: string,
  payload: CreateRatingPayload,
): Promise<PlayerRating> {
  const resp = await client.post(
    `/api/catalog/teamplayer/${teamPlayerId}/ratings/conceptual`,
    payload,
  );
  return resp.data as PlayerRating;
}

/** @deprecated Use createRating with isGoalkeeper:true */
export type CreateGoalkeeperRatingPayload = CreateRatingPayload;

/** @deprecated Use createRating with isGoalkeeper:true */
export async function createGoalkeeperRating(
  teamPlayerId: string,
  payload: CreateGoalkeeperRatingPayload
): Promise<PlayerRating> {
  const resp = await client.post(`/api/catalog/teamplayer/${teamPlayerId}/ratings/goalkeeper`, payload);
  return resp.data as PlayerRating;
}

const playerRatingService = { getRatingHistory, getTeamLatestRatings, createRating, createGoalkeeperRating };
export default playerRatingService;
