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

export type AttendanceRatio = {
  attended: number;
  possible: number;
  /** Convocado y aceptado, pero no asistió (justificado o no). Ya incluido en "possible", no en "attended". */
  calledButAbsent: number;
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
  trainings: AttendanceRatio;
  friendlies: AttendanceRatio;
  league: AttendanceRatio;
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
  /** Partidos del equipo donde la ausencia es imputable al jugador. Siempre calculado. */
  matchesAbsentAttributableToPlayer: number;
  /** % de minutos jugados sobre el total posible de la temporada. `null` si el equipo no es F11. */
  minutesPlayedPercentOfSeasonTotal: number | null;
  /** % del total posible de temporada perdido por ausencias imputables al jugador. `null` si el equipo no es F11. */
  attributableAbsentMinutesPercentOfSeasonTotal: number | null;
};

/** Objetivo de temporada: un jugador debe llegar al menos al 30% de los minutos totales del equipo. */
export const SEASON_MINUTES_TARGET_PERCENT = 30;

export async function getTeamPlayerStatistics(teamId: string): Promise<PlayerStatistics[]> {
  const resp = await client.get(`/api/catalog/team/${teamId}/player-stats`);
  return resp.data as PlayerStatistics[];
}

export default { getTeamPlayerStatistics };
