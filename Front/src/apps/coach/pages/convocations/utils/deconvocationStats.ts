import type { GridCell, MatchColumn } from "../components/convocationMatchDetail.types";

// Status names that mean the player was NOT called up / deconvoked
const NOT_CALLED_NAMES = new Set(["Deconvoke", "No disponible"]);

export function isCellNotCalled(cell: GridCell): boolean {
  return NOT_CALLED_NAMES.has(cell.statusName);
}

/** Number of players deconvoked in at least one of the given past matches. */
export function countDeconvokedPlayers(
  players: ReadonlyArray<{ id: string }>,
  matchColumns: MatchColumn[],
  enrichedGrid: Map<string, Map<string, GridCell>>,
): number {
  return players.filter((player) =>
    matchColumns.some((col) => {
      const cell = enrichedGrid.get(col.eventId)?.get(player.id);
      return cell !== undefined && isCellNotCalled(cell);
    }),
  ).length;
}
