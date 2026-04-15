// ─── Live Match domain types ──────────────────────────────────────────────────

import type { SimulationPlayerState, SubstitutionWindow } from "./simulation.types";

/** Active phase of a live match */
export type LiveMatchPhase =
  | "preMatch"
  | "firstHalf"
  | "halftime"
  | "secondHalf"
  | "finished";

/** A goal event recorded during the match */
export interface GoalEvent {
  id: string;
  /** Match minute when the goal was scored */
  minute: number;
  /** teamPlayerId of the scorer, null if it's a rival goal or own goal with no scorer assigned */
  scorerId: string | null;
  scorerName: string | null;
  scorerDorsal: number | null;
  /** True when the goal belongs to our team (including own goals in our favour) */
  isOwnTeam: boolean;
  /** Scoreline after this goal */
  scoreAtMoment: { local: number; visitor: number };
}

/** Per-player competitiveness snapshot captured when a window is committed */
export interface WindowRatingSnapshot {
  windowIndex: number;
  minute: number;
  /** teamPlayerId → competitiveness rating */
  ratings: Record<string, number | null>;
}

/** Full backup saved to localStorage when the user leaves the page */
export interface LiveMatchBackup {
  /** Sport-event ID — used as the backup key discriminator */
  eventId: string;
  teamId: string;
  /** ISO timestamp of when the backup was written */
  savedAt: string;
  matchPhase: LiveMatchPhase;
  /** Total elapsed seconds at backup time */
  totalSeconds: number;
  half: 1 | 2;
  isHalftime: boolean;
  halfDuration: number;
  slots: Record<number, string | null>;
  initialSlots: Record<number, string | null>;
  playerStates: Record<string, SimulationPlayerState>;
  windows: SubstitutionWindow[];
  goals: GoalEvent[];
  ratingSnapshots: WindowRatingSnapshot[];
  scoreLocal: number;
  scoreVisitor: number;
}

// ─── Backend payload types ─────────────────────────────────────────────────────

export interface PlayerParticipationDto {
  teamPlayerId: string;
  /** Total minutes played in the match */
  minutesPlayed: number;
  isStarter: boolean;
  enteredAtMinute: number | null;
  exitedAtMinute: number | null;
}

export interface LiveMatchParticipationPayload {
  teamId: string;
  scoreLocal: number;
  scoreVisitor: number;
  matchPhase: string;
  players: PlayerParticipationDto[];
  /** Serialised substitution windows */
  substitutionWindowsJson: string;
  /** Serialised rating snapshots */
  ratingSnapshotsJson: string;
  /** Serialised goal events */
  goalsJson: string;
}

// ─── Season & history stats ────────────────────────────────────────────────────

/** Aggregated season statistics for one player across all finished matches */
export interface SeasonPlayerStats {
  teamPlayerId: string;
  totalMinutes: number;
  totalGoals: number;
  totalStarts: number;
  totalMatches: number;
}

/** Per-match participation record returned by the match history endpoint */
export interface PlayerMatchRecord {
  eventId: string;
  minutesPlayed: number;
  isStarter: boolean;
  enteredAtMinute: number | null;
  exitedAtMinute: number | null;
  goalsScored: number;
  scoreLocal: number;
  scoreVisitor: number;
  savedAt: string; // ISO timestamp
}
