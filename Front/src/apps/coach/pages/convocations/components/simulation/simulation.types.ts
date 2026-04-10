// ─── Simulation domain types ─────────────────────────────────────────────────

/** Runtime state of a single player during a simulated match */
export interface SimulationPlayerState {
  playerId: string;
  /** Slot index on the field, or null when the player is on the bench */
  slotIndex: number | null;
  /** Match minute when the player last entered the field */
  minuteEntered: number;
  /** Minutes accumulated from all previous stints (frozen when player leaves) */
  accumulatedMinutes: number;
  /** Whether the player is currently on the field */
  isOnField: boolean;
}

/** One player swap within a substitution window */
export interface SubstitutionSwap {
  /** Player entering the field */
  inPlayerId: string;
  /** Player leaving the field (null if the target slot was empty) */
  outPlayerId: string | null;
  /** Field slot where the swap takes place */
  slotIndex: number;
}

/** A substitution window — max 4 per match, max 3 in the 2nd half */
export interface SubstitutionWindow {
  /** 1-based sequential index within the match */
  windowIndex: number;
  /** Match minute at which the window was confirmed */
  minute: number;
  /** Half in which the window occurred */
  half: 1 | 2;
  /** Individual player swaps performed in this window */
  swaps: SubstitutionSwap[];
  /** Complete slot map immediately after this window is applied */
  slotsAfter: Record<number, string | null>;
  /** True when applied at halftime — does not count against window quota */
  isHalftime?: boolean;
}

/** A fully serialisable saved match simulation (persisted to localStorage) */
export interface MatchSimulation {
  id: string;
  name: string;
  teamId: string;
  eventId: string;
  formationId: string;
  createdAt: string;
  /** Match minute at which the simulation was saved */
  savedAtMinute: number;
  /** Slot layout at match kick-off */
  initialSlots: Record<number, string | null>;
  /** Executed substitution windows in chronological order */
  windows: SubstitutionWindow[];
  /** Per-player runtime state at save time */
  playerStates: Record<string, SimulationPlayerState>;
}
