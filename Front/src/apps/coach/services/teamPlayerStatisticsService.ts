import client from "../../../core/api/client";

export type RecentAbsence = {
  eventId: string;
  date: string | null;
  reason: string;
  pointsImpact: number;
};

export type ReadinessBreakdown = {
  trainingComponent: number;
  matchComponent: number;
  trainingSessionsConsidered: number;
  trainingSessionsBaseline: number;
  matchMinutesInWindow: number;
  matchMinutesExpected: number;
  recentAbsences: RecentAbsence[];
};

export type PlayerStatistics = {
  teamPlayerId: string;
  displayName: string;
  position: string | null;
  dorsal: number | null;
  goals: number;
  yellowCards: number;
  redCards: number;
  minutesPlayed: number;
  trainingsAttended: number;
  matchesPlayed: number;
  daysSinceLastInjury: number | null;
  lastInjuryDurationDays: number | null;
  /** Forma física (0-100), persistida y actualizada de forma incremental. Siempre tiene valor. */
  physicalFitness: number;
  /** Cansancio (0-100), persistido y actualizado de forma incremental. Siempre tiene valor. */
  fatigue: number;
  /** Disponibilidad = max(0, physicalFitness - fatigue). Siempre tiene valor. */
  availability: number;
  readiness: number | null;
  readinessBreakdown: ReadinessBreakdown | null;
};

export async function getTeamPlayerStatistics(teamId: string): Promise<PlayerStatistics[]> {
  const resp = await client.get(`/api/catalog/team/${teamId}/player-stats`);
  return resp.data as PlayerStatistics[];
}

export default { getTeamPlayerStatistics };
