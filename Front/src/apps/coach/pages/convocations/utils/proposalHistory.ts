import type { GridCell, MatchColumn } from "../components/convocationMatchDetail.types";
import { getCauseColor, getCauseLabel, isTechnicalDecisionCell, type CauseColor } from "./deconvocationCauses";
import { isCellNotCalled } from "./deconvocationStats";
import { leagueStreaks } from "./technicalTotals";

export type ProposalHistoryCause = CauseColor & { label: string };

export type ProposalHistorySummary = {
  total: number;
  technical: number;
  /** League matchdays since the last technical decision. */
  streak: number;
  /** One cell per league match, oldest first; `cause` is null when the player was not deconvoked. */
  season: Array<{ eventId: string; label: string; cause: ProposalHistoryCause | null }>;
  /** Most frequent first. */
  causes: Array<{ cause: ProposalHistoryCause; count: number }>;
  last: { label: string; cause: ProposalHistoryCause } | null;
};

/** Deconvocation history of one player as the proposal sees it: league matches only. `columns` is newest first. */
export function buildProposalHistory(
  playerId: string,
  columns: MatchColumn[],
  grid: Map<string, Map<string, GridCell>>,
): ProposalHistorySummary {
  const causes = new Map<string, { cause: ProposalHistoryCause; count: number }>();
  let total = 0;
  let technical = 0;
  let last: ProposalHistorySummary["last"] = null;

  const newestFirst = columns
    .filter((col) => col.isLeague !== false)
    .map((col) => {
      const cell = grid.get(col.eventId)?.get(playerId);
      if (!cell || !isCellNotCalled(cell)) return { eventId: col.eventId, label: col.label, cause: null };
      const cause = { label: getCauseLabel(cell), ...getCauseColor(cell) };
      total++;
      if (isTechnicalDecisionCell(cell)) technical++;
      last ??= { label: col.label, cause };
      const known = causes.get(cause.label);
      if (known) known.count++;
      else causes.set(cause.label, { cause, count: 1 });
      return { eventId: col.eventId, label: col.label, cause };
    });

  return {
    total,
    technical,
    streak: leagueStreaks([playerId], columns, grid).get(playerId) ?? 0,
    season: newestFirst.reverse(),
    causes: Array.from(causes.values()).sort((a, b) => b.count - a.count),
    last,
  };
}
