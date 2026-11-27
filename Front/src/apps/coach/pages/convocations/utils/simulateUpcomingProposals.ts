import type { GridCell, MatchColumn } from "../components/convocationMatchDetail.types";
import { buildDeconvokeProposal, type BuildProposalInput, type DeconvokeProposal } from "./deconvokeProposal";
import type { UpcomingMatch } from "./rivalDifficulty";
import { leagueStreaks, leagueTechnicalTotals } from "./technicalTotals";

export type SimulatedProposal = {
  match: UpcomingMatch;
  proposal: DeconvokeProposal;
};

export type SimulationInput = {
  /** Inputs of the real proposal for the match being prepared. */
  base: BuildProposalInput;
  /** The real proposal for that match: assumed applied before the first estimated match. */
  baseProposal: DeconvokeProposal;
  /** Next league matches, in order. */
  matches: UpcomingMatch[];
  /** Estimated recovery date of the players injured today; none or null keeps them out for the whole window. */
  injuryReturn?: ReadonlyMap<string, string | null>;
};

const CALLED_CELL: GridCell = { statusId: 2, excuseTypeId: null, statusName: "Convocado", excuseName: null };
const TECHNICAL_CELL: GridCell = { statusId: 5, excuseTypeId: null, statusName: "Deconvoke", excuseName: "Decisión técnica" };
const INJURY_CELL: GridCell = { statusId: 5, excuseTypeId: 1, statusName: "Deconvoke", excuseName: "Lesión" };
const OTHER_CELL: GridCell = { statusId: 5, excuseTypeId: 2, statusName: "Deconvoke", excuseName: "Otro motivo" };

/** What the match column looks like once the proposal is applied: who was out and why, and who was called. */
function columnAfter(proposal: DeconvokeProposal, playerIds: string[], injuredIds: ReadonlySet<string>): Map<string, GridCell> {
  const selected = new Set(proposal.selectedIds);
  const forced = new Set(proposal.players.filter((p) => p.forced).map((p) => p.playerId));
  const alreadyOut = new Set(proposal.alreadyDeconvoked.map((p) => p.playerId));
  return new Map(
    playerIds.map((id) => {
      if (injuredIds.has(id) || forced.has(id)) return [id, INJURY_CELL];
      if (alreadyOut.has(id)) return [id, OTHER_CELL];
      return [id, selected.has(id) ? TECHNICAL_CELL : CALLED_CELL];
    }),
  );
}

/**
 * Estimates the proposal of each next match, chained: the proposal of the previous match is assumed
 * applied before computing the next. Everyone is assumed to train, injured players stay out until
 * their estimated recovery, and the low-minutes rule does not apply.
 */
export function simulateUpcomingProposals({ base, baseProposal, matches, injuryReturn }: SimulationInput): SimulatedProposal[] {
  if (matches.length === 0) return [];
  const playerIds = base.calledIds;
  const injuredToday = new Set(base.players.filter((p) => p.isInjured === true).map((p) => p.id));

  let columns: MatchColumn[] = base.seasonColumns;
  let grid = new Map(base.enrichedGrid);
  const addColumn = (column: MatchColumn, cells: Map<string, GridCell>) => {
    columns = [column, ...columns];
    grid = new Map(grid).set(column.eventId, cells);
  };
  addColumn(
    { eventId: base.currentEventId ?? "current-match", label: "Actual", date: base.currentDate ?? "", rival: base.currentRival, isLeague: true },
    columnAfter(baseProposal, playerIds, injuredToday),
  );

  const result: SimulatedProposal[] = [];
  matches.forEach((match, index) => {
    const returned = new Set(
      [...injuredToday].filter((id) => {
        const back = injuryReturn?.get(id);
        return back != null && back.slice(0, 10) <= match.date;
      }),
    );
    const stillInjured = new Set([...injuredToday].filter((id) => !returned.has(id)));
    const lastInjuryEndMap = new Map(base.lastInjuryEndMap);
    const lastInjuryStartMap = new Map(base.lastInjuryStartMap ?? []);
    returned.forEach((id) => {
      lastInjuryEndMap.set(id, injuryReturn?.get(id) ?? null);
      lastInjuryStartMap.set(id, base.players.find((p) => p.id === id)?.injuryStartDate ?? null);
    });

    const proposal = buildDeconvokeProposal({
      ...base,
      players: base.players.map((p) => (returned.has(p.id) ? { ...p, isInjured: false } : p)),
      alreadyOutIds: stillInjured,
      streaks: leagueStreaks(playerIds, columns, grid),
      technicalTotals: leagueTechnicalTotals(playerIds, columns, grid),
      seasonColumns: columns,
      enrichedGrid: grid,
      lastInjuryEndMap,
      lastInjuryStartMap,
      currentDate: match.date,
      currentEventId: match.eventId,
      currentRival: match.rival,
      weekTrainingStats: new Map(),
      weekTrainingCount: 0,
      matchUnavailable: new Map(),
      rivalDifficulty: match.difficulty,
      upcomingDifficulties: matches.slice(index + 1).map((m) => m.difficulty),
      rivalWinProbability: match.winProbability,
      upcomingWinProbabilities: matches.slice(index + 1).map((m) => m.winProbability),
      rivalPosition: match.rivalPosition,
      upcomingRivalPositions: matches.slice(index + 1).map((m) => m.rivalPosition),
      lastMatchMinutes: null,
    });
    result.push({ match, proposal });
    addColumn(
      { eventId: match.eventId, label: match.label, date: match.date, rival: match.rival, isLeague: true },
      columnAfter(proposal, playerIds, stillInjured),
    );
  });
  return result;
}
