import type { GridCell, MatchColumn } from "../components/convocationMatchDetail.types";

function isTechnicalDeconvocation(cell: GridCell | undefined): boolean {
  if (!cell || cell.statusName !== "Deconvoke") return false;
  return !cell.excuseTypeId || !!cell.excuseName?.toLowerCase().includes("decisi");
}

/** League matchdays in a row, newest first, without a technical decision (friendlies and tournaments are left out). */
export function leagueStreaks(
  playerIds: string[],
  columns: MatchColumn[],
  grid: Map<string, Map<string, GridCell>>,
): Map<string, number> {
  const leagueColumns = columns.filter((col) => col.isLeague !== false);
  return new Map(
    playerIds.map((id) => {
      const lastTechnical = leagueColumns.findIndex((col) => isTechnicalDeconvocation(grid.get(col.eventId)?.get(id)));
      return [id, lastTechnical < 0 ? leagueColumns.length : lastTechnical];
    }),
  );
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
