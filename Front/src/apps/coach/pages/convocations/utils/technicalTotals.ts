import type { GridCell, MatchColumn } from "../components/convocationMatchDetail.types";

function isTechnicalDeconvocation(cell: GridCell | undefined): boolean {
  if (!cell || cell.statusName !== "Deconvoke") return false;
  return !cell.excuseTypeId || !!cell.excuseName?.toLowerCase().includes("decisi");
}

/** Technical deconvocations per player, counting only league matches (friendlies and tournaments are left out). */
export function leagueTechnicalTotals(
  playerIds: string[],
  columns: MatchColumn[],
  grid: Map<string, Map<string, GridCell>>,
): Map<string, number> {
  const leagueColumns = columns.filter((col) => col.isLeague !== false);
  return new Map(
    playerIds.map((id) => [
      id,
      leagueColumns.reduce((total, col) => total + (isTechnicalDeconvocation(grid.get(col.eventId)?.get(id)) ? 1 : 0), 0),
    ]),
  );
}
