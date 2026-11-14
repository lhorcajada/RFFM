import client from "../../../core/api/client";
import type { FitPosition, TraitWeight } from "../pages/squad/rating/ratingTraits";
import type { PositionFit } from "../types/positionFit";

export async function getTeamPositionFit(teamId: string): Promise<PositionFit[]> {
  const resp = await client.get(`/api/catalog/team/${teamId}/position-fit`);
  return resp.data as PositionFit[];
}

export async function savePositionFitOrder(
  teamId: string,
  position: FitPosition,
  teamPlayerIds: string[],
): Promise<PositionFit> {
  const resp = await client.put(`/api/catalog/team/${teamId}/position-fit/${position}`, { teamPlayerIds });
  return resp.data as PositionFit;
}

export async function savePositionTraitWeights(
  teamId: string,
  position: FitPosition,
  weights: Record<string, TraitWeight>,
): Promise<PositionFit> {
  const resp = await client.put(`/api/catalog/team/${teamId}/position-fit/${position}/weights`, { weights });
  return resp.data as PositionFit;
}
