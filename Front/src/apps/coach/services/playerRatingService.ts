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

export type CreateRatingPayload = {
  physicalSpeed: number;
  physicalEndurance: number;
  physicalStrength: number;
  technicalDribbling: number;
  technicalPassing: number;
  technicalControl: number;
  technicalShooting: number;
  technicalTackling: number;
  technicalInterceptions: number;
  technicalHeading: number;
  tacticalDefensiveAwareness: number;
  tacticalMarking: number;
  tacticalTrackBack: number;
  tacticalPressing: number;
  tacticalGeneratesAdvantage: number;
  tacticalOffMovement: number;
  tacticalBeatsOpponents: number;
  tacticalAttackParticipation: number;
  competDuelWinning: number;
  competLooseBalls: number;
  competRecoveries: number;
  competDecisiveActions: number;
  competResponsibility: number;
  competConstantEffort: number;
  notes?: string | null;
};

export async function createRating(
  teamPlayerId: string,
  payload: CreateRatingPayload
): Promise<PlayerRating> {
  const resp = await client.post(`/api/catalog/teamplayer/${teamPlayerId}/ratings`, payload);
  return resp.data as PlayerRating;
}

export type CreateGoalkeeperRatingPayload = {
  keeperReactionSpeed: number;
  keeperAgility: number;
  keeperJumpPower: number;
  keeperStrength: number;
  keeperEndurance: number;
  keeperHandSecurity: number;
  keeperSaves: number;
  keeperAerialPlay: number;
  keeperHandDistribution: number;
  keeperKickDistribution: number;
  keeperFirstTouch: number;
  keeperPlayUnderPressure: number;
  keeperPositioning: number;
  keeperGameReading: number;
  keeperOneOnOne: number;
  keeperBackCoverage: number;
  keeperSallyTiming: number;
  keeperBuildupPlay: number;
  keeperDefensiveOrganization: number;
  keeperValor: number;
  keeperConcentration: number;
  keeperKeyMoments: number;
  keeperErrorManagement: number;
  keeperResponsibility: number;
  keeperConsistency: number;
  notes?: string | null;
};

export async function createGoalkeeperRating(
  teamPlayerId: string,
  payload: CreateGoalkeeperRatingPayload
): Promise<PlayerRating> {
  const resp = await client.post(`/api/catalog/teamplayer/${teamPlayerId}/ratings/goalkeeper`, payload);
  return resp.data as PlayerRating;
}

const playerRatingService = { getRatingHistory, getTeamLatestRatings, createRating, createGoalkeeperRating };
export default playerRatingService;
