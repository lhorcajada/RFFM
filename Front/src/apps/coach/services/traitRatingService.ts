import client from "../../../core/api/client";
import type { TraitLevel, TraitRating, TraitTrend } from "../types/traitRating";

export async function getTeamLatestTraitRatings(teamId: string): Promise<TraitRating[]> {
  const resp = await client.get(`/api/catalog/team/${teamId}/trait-ratings/latest`);
  return resp.data as TraitRating[];
}

export type TraitRatingItem = {
  teamPlayerId: string;
  trend: TraitTrend;
  levels: TraitLevel[];
};

export type CreateTeamTraitRatingsPayload = {
  ratedAt?: string | null;
  ratings: TraitRatingItem[];
};

export async function createTeamTraitRatings(
  teamId: string,
  payload: CreateTeamTraitRatingsPayload,
): Promise<TraitRating[]> {
  const resp = await client.post(`/api/catalog/team/${teamId}/trait-ratings`, payload);
  return resp.data as TraitRating[];
}
