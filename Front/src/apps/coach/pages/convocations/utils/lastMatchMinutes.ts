import type { MatchColumn } from "../components/convocationMatchDetail.types";
import type { MatchMinutesRow } from "../../../services/liveMatchService";

export type LastMatchMinutes = {
  /** Label of the match column, e.g. "J9 · 21 oct". */
  label: string;
  /** Minutes played by every player registered in that match (0 when called but unused). */
  minutes: Map<string, number>;
};

/**
 * Minutes of the most recent match of the season that has participation data. `seasonColumns` is
 * ordered newest first. Null when no match has minutes yet.
 */
export function buildLastMatchMinutes(
  rows: MatchMinutesRow[],
  seasonColumns: MatchColumn[],
): LastMatchMinutes | null {
  for (const col of seasonColumns) {
    const matchRows = rows.filter((r) => r.eventId === col.eventId);
    if (matchRows.length === 0) continue;
    return {
      label: col.label,
      minutes: new Map(matchRows.map((r) => [r.teamPlayerId, r.minutesPlayed])),
    };
  }
  return null;
}
