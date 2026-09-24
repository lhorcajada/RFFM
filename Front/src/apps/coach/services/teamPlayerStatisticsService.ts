import client from "../../../core/api/client";

export type DailyLoadStepKind = "Activity" | "Decay";

export type DailyLoadEvent = {
  eventId: string;
  eventTypeId: number;
  trainingTypes: string[];
  minutesPlayed: number;
  typeWeight: number;
  load: number;
};

export type DailyLoadStep = {
  date: string;
  /** Solo en pasos "Decay": último día de la racha de descanso con pérdida. */
  endDate: string | null;
  kind: DailyLoadStepKind;
  load: number;
  valueBefore: number;
  valueAfter: number;
  events: DailyLoadEvent[];
};

export type MissedEvent = {
  eventId: string;
  date: string;
  eventTypeId: number;
  reason: string;
};

/** Desglose común de Estado de forma y Rodaje (modelo de carga diaria). */
export type DailyLoadBreakdown = {
  /** Valor sin redondear (0-100). */
  value: number;
  replayStartDate: string;
  replayDays: number;
  gainRate: number;
  graceRestDays: number;
  decayStepPerDay: number;
  decayMaxPerDay: number;
  matchLoadPerReferenceMatch: number;
  referenceMatchMinutes: number;
  /** Días seguidos sin actividad hasta hoy. */
  currentRestStreakDays: number;
  trainingsAttended: number;
  matchesPlayed: number;
  matchMinutesPlayed: number;
  /** Más reciente primero. */
  steps: DailyLoadStep[];
  /** Más reciente primero, máximo 10. */
  missedEvents: MissedEvent[];
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

export type MinutesTargetStatus = "Met" | "NotMetByOwnAbsences" | "NotMet";

export type AttributableAbsenceKind = "NoShow" | "Declined";

export type AttributableAbsence = {
  eventId: string;
  date: string;
  eventTypeId: number;
  /** Rival, o nombre del evento si no tiene rival. */
  opponent: string;
  /** Duración del partido usada en el objetivo de minutos (0 si no es F11). */
  matchMinutes: number;
  kind: AttributableAbsenceKind;
  reason: string | null;
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
  /** Rodaje (0-100). `null` si no hay actividad en los últimos 84 días. */
  readinessBreakdown: DailyLoadBreakdown | null;
  /** Partidos del equipo donde la ausencia es imputable al jugador. Siempre calculado. */
  matchesAbsentAttributableToPlayer: number;
  /** % de minutos jugados sobre el total posible de la temporada. `null` si el equipo no es F11. */
  minutesPlayedPercentOfSeasonTotal: number | null;
  /** % del total posible de temporada perdido por ausencias imputables al jugador. `null` si el equipo no es F11. */
  attributableAbsentMinutesPercentOfSeasonTotal: number | null;
  /** % de minutos jugados sobre sus minutos disponibles (total − ausencias imputables). `null` si no es F11 o no tiene minutos disponibles. */
  minutesPlayedPercentOfAvailable: number | null;
  /** Veredicto del objetivo de minutos. `null` si el equipo no es F11 o no ha disputado minutos. */
  minutesTargetStatus: MinutesTargetStatus | null;
  /** Partidos con ausencia imputable al jugador, más reciente primero. */
  attributableAbsences: AttributableAbsence[];
  /** Estado de forma (0-100). `null` si no hay actividad en los últimos 84 días o la categoría no tiene duración estándar. */
  formStatus: number | null;
  formStatusBreakdown: DailyLoadBreakdown | null;
};

/** Objetivo de temporada: un jugador debe llegar al menos al 30% de los minutos totales del equipo. */
export const SEASON_MINUTES_TARGET_PERCENT = 30;

export async function getTeamPlayerStatistics(teamId: string): Promise<PlayerStatistics[]> {
  const resp = await client.get(`/api/catalog/team/${teamId}/player-stats`);
  return resp.data as PlayerStatistics[];
}

export default { getTeamPlayerStatistics };
