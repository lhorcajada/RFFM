import client from "../../../core/api/client";

export type RecentAbsence = {
  eventId: string;
  date: string | null;
  reason: string;
  pointsImpact: number;
};

export type ReadinessConsideredTraining = {
  eventId: string;
  eventDate: string | null;
  trainingTypes: string[];
  countsTowardScore: boolean;
  points: number;
  typeWeight: number;
  contribution: number;
  reason: string;
};

export type ReadinessConsideredMatch = {
  eventId: string;
  eventDate: string | null;
  eventTypeId: number;
  minutesPlayed: number;
  typeWeight: number;
  effectiveMinutes: number;
};

export type ReadinessBreakdown = {
  trainingComponent: number;
  matchComponent: number;
  trainingSessionsConsidered: number;
  trainingSessionsBaseline: number;
  matchMinutesInWindow: number;
  matchMinutesExpected: number;
  trainingWeight: number;
  matchWeight: number;
  recentAbsences: RecentAbsence[];
  consideredTrainings: ReadinessConsideredTraining[];
  consideredMatches: ReadinessConsideredMatch[];
};

export type FatigueConsideredTraining = {
  eventId: string;
  eventDate: string | null;
  trainingTypes: string[];
  daysAgo: number;
  decay: number;
  typeWeight: number;
  contribution: number;
};

export type FatigueConsideredMatch = {
  eventId: string;
  eventDate: string | null;
  eventTypeId: number;
  minutesPlayed: number;
  daysAgo: number;
  decay: number;
  typeWeight: number;
  effectiveMinutes: number;
};

export type FatigueBreakdown = {
  trainingComponent: number;
  matchComponent: number;
  decayedTrainingCount: number;
  decayedMatchMinutes: number;
  trainingWeight: number;
  matchWeight: number;
  consideredTrainings: FatigueConsideredTraining[];
  consideredMatches: FatigueConsideredMatch[];
};

export type FormStatusConsideredTraining = {
  eventId: string;
  eventDate: string | null;
  trainingTypes: string[];
  daysAgo: number;
  recencyWeight: number;
  typeWeight: number;
  offeredLoad: number;
  attended: boolean;
  receivedLoad: number;
  absenceReason: string | null;
};

export type FormStatusMatchStatus = "Played" | "NotPlayed" | "Absent";

export type FormStatusConsideredMatch = {
  eventId: string;
  eventDate: string | null;
  eventTypeId: number;
  daysAgo: number;
  recencyWeight: number;
  minutesPlayed: number;
  fullMatchMinutes: number;
  ratio: number;
  contribution: number;
  status: FormStatusMatchStatus;
};

export type FormStatusBreakdown = {
  windowDays: number;
  recencyFullWeightDays: number;
  recencyHalfLifeDays: number;
  trainingComponent: number | null;
  trainingSessionsOffered: number;
  trainingSessionsAttended: number;
  trainingLoadOffered: number;
  trainingLoadReceived: number;
  trainingTypeWeightFallbackUsed: boolean;
  excludedTrainings: number;
  matchComponent: number | null;
  referenceTrainingSessions: number;
  trainingRatioComponent: number | null;
  trainingVolumeFactor: number | null;
  matchMinutesPlayedTotal: number;
  matchMinutesPossibleTotal: number;
  matchesConsidered: number;
  categoryMatchMinutes: number;
  fullStimulusFraction: number;
  fullMatchMinutes: number;
  matchRecencyWeightSum: number;
  matchRatioWeightedSum: number;
  excludedMatches: number;
  trainingWeightNominal: number;
  matchWeightNominal: number;
  trainingWeightApplied: number;
  matchWeightApplied: number;
  baseScore: number;
  fatigue: number;
  fatigueFactor: number;
  consideredTrainings: FormStatusConsideredTraining[];
  consideredMatches: FormStatusConsideredMatch[];
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
  /** Cansancio (0-100), persistido y actualizado de forma incremental. Siempre tiene valor. */
  fatigue: number;
  /** Desglose del cansancio. Nunca null: `fatigue` siempre tiene valor (0 cuando no hay eventos). */
  fatigueBreakdown: FatigueBreakdown;
  readiness: number | null;
  readinessBreakdown: ReadinessBreakdown | null;
  /** Partidos del equipo donde la ausencia es imputable al jugador. Siempre calculado. */
  matchesAbsentAttributableToPlayer: number;
  /** % de minutos jugados sobre el total posible de la temporada. `null` si el equipo no es F11. */
  minutesPlayedPercentOfSeasonTotal: number | null;
  /** % del total posible de temporada perdido por ausencias imputables al jugador. `null` si el equipo no es F11. */
  attributableAbsentMinutesPercentOfSeasonTotal: number | null;
  /** Estado de forma (0-100). `null` si no hay datos suficientes en la ventana de 8 semanas. */
  formStatus: number | null;
  formStatusBreakdown: FormStatusBreakdown | null;
};

/** Objetivo de temporada: un jugador debe llegar al menos al 30% de los minutos totales del equipo. */
export const SEASON_MINUTES_TARGET_PERCENT = 30;

export async function getTeamPlayerStatistics(teamId: string): Promise<PlayerStatistics[]> {
  const resp = await client.get(`/api/catalog/team/${teamId}/player-stats`);
  return resp.data as PlayerStatistics[];
}

export default { getTeamPlayerStatistics };
