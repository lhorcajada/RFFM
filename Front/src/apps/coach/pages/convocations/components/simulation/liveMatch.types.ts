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
  /** Pitch cell the goal was scored from; null if not recorded (legacy goals) */
  pitchZone: { col: number; row: number } | null;
  /** Body part used to score; null if not recorded (legacy goals) */
  bodyPart: "head" | "foot" | null;
}

/** A card (amonestación) event recorded during the match */
export interface CardEvent {
  id: string;
  /** Match minute when the card was shown */
  minute: number;
  /** Match half (1st or 2nd) — no extra time/penalties support */
  half: 1 | 2;
  cardType: "yellow" | "red";
  /** Own-team player, or null for a rival card */
  teamPlayerId: string | null;
  playerName: string | null;
  /** True when the card was shown to a rival player */
  isRivalPlayer: boolean;
  /** Free-text shirt number, only meaningful when isRivalPlayer is true */
  rivalDorsal: number | null;
}

/** A mid-match tactical formation change */
export interface FormationChangeEvent {
  id: string;
  /** Match minute when the formation was changed */
  minute: number;
  half: 1 | 2;
  formationId: string;
  /** Snapshot of the formation name at change time, so history survives renames */
  formationName: string;
  /** Full slot map immediately after the change */
  slotsAfter: Record<number, string | null>;
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
  cards: CardEvent[];
  formationChanges: FormationChangeEvent[];
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
  /** Post-match free-text reason explaining reduced minutes; null/absent when unset. */
  minutesReason?: string | null;
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
  /** Serialised card events */
  cardsJson: string;
  /** Serialised formation-change events */
  formationChangesJson: string;
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

/** One player swap within a substitution window record (match history endpoint) */
export interface SubstitutionSwapRecord {
  /** Player entering the field */
  inPlayerId: string;
  /** Player leaving the field (null if the target slot was empty) */
  outPlayerId: string | null;
  /** Field slot where the swap takes place */
  slotIndex: number;
}

/** A substitution window as returned by the match history endpoint */
export interface SubstitutionWindowRecord {
  /** 1-based sequential index within the match */
  windowIndex: number;
  /** Match minute at which the window was confirmed */
  minute: number;
  /** Half in which the window occurred */
  half: 1 | 2;
  /** Individual player swaps performed in this window */
  swaps: SubstitutionSwapRecord[];
}

/** Per-match participation record returned by the match history endpoint */
export interface PlayerMatchRecord {
  eventId: string;
  minutesPlayed: number;
  isStarter: boolean;
  enteredAtMinute: number | null;
  exitedAtMinute: number | null;
  goalsScored: number;
  /** Yellow cards received by this player in this match */
  yellowCards: number;
  /** Red cards received by this player in this match */
  redCards: number;
  /** Rival club name, null if not resolved */
  rivalName: string | null;
  eventTypeId: number;
  eventTypeName: string;
  /** Full list of substitution windows for the match (may include swaps of other players) */
  substitutionWindows: SubstitutionWindowRecord[];
  scoreLocal: number;
  scoreVisitor: number;
  /** Date of the match itself (SportEvent.eveDateTime), null if the event has no date */
  matchDate: string | null;
  /** Post-match free-text reason explaining reduced minutes; null when unset. */
  minutesReason?: string | null;
}
