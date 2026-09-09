import type { PlayerMatchRecord } from "../../convocations/components/simulation/liveMatch.types";

/** One continuous period a player spent on the field during a match */
export interface PlayerStint {
  enteredAtMinute: number;
  /** null when the stint is still open at the end of the match */
  exitedAtMinute: number | null;
}

/**
 * Derives the list of on-field stints (entries/exits) for a given player in a given match,
 * from the full list of substitution windows of that match.
 *
 * Algorithm: walk the substitution windows in chronological order; if the player started the
 * match, the first stint begins at minute 0; each swap where `inPlayerId` matches opens a new
 * stint at the window's minute; each swap where `outPlayerId` matches closes the currently open
 * stint at the window's minute. A stint still open at the end of the match gets
 * `exitedAtMinute: null`.
 */
export function derivePlayerStints(
  record: PlayerMatchRecord,
  teamPlayerId: string
): PlayerStint[] {
  const stints: PlayerStint[] = [];
  let openStint: PlayerStint | null = null;

  if (record.isStarter) {
    openStint = { enteredAtMinute: 0, exitedAtMinute: null };
    stints.push(openStint);
  }

  const windows = [...record.substitutionWindows].sort((a, b) => a.minute - b.minute);

  for (const window of windows) {
    for (const swap of window.swaps) {
      if (swap.outPlayerId === teamPlayerId && openStint) {
        openStint.exitedAtMinute = window.minute;
        openStint = null;
      }
      if (swap.inPlayerId === teamPlayerId) {
        openStint = { enteredAtMinute: window.minute, exitedAtMinute: null };
        stints.push(openStint);
      }
    }
  }

  return stints;
}
