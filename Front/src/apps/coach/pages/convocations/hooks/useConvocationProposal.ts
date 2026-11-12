import { useMemo } from "react";
import type { SportEventResponse } from "../../../services/sportEventService";
import type { PlayerResponse } from "../../../services/teamplayerService";
import type { PlayerRating } from "../../../types/playerRating";
import type { GridCell, MatchColumn } from "../components/convocationMatchDetail.types";
import type { SeasonPlayerStats } from "../components/simulation/liveMatch.types";
import type { DeconvokeProposal, WeeklyTrainingStats } from "../utils/deconvokeProposal";
import { buildDeconvokeProposal } from "../utils/deconvokeProposal";
import type { MatchUnavailability } from "../utils/matchUnavailability";
import type { DeconvocationRuleConfig } from "../utils/rules/ruleCatalog";

type UseConvocationProposalInput = {
  players: PlayerResponse[];
  /** Whole squad: the proposal picks who to leave out from every player, not only those already called. */
  squadIds: string[];
  /** Players already deconvoked, whatever the reason: not proposed, not counted as available, and returned in alreadyDeconvoked for display. */
  alreadyOutIds?: ReadonlySet<string>;
  ratings: Record<string, PlayerRating>;
  playerStreaks: Map<string, number>;
  playerTechnicalTotals: Map<string, number>;
  seasonEvents: SportEventResponse[];
  seasonColumns: MatchColumn[];
  enrichedGrid: Map<string, Map<string, GridCell>>;
  seasonStats: SeasonPlayerStats[];
  lastInjuryEndMap: Map<string, string | null>;
  lastInjuryStartMap?: Map<string, string | null>;
  lastInjuryMissedEventsMap?: Map<string, number>;
  currentDate: string | undefined;
  currentEventId: string | null;
  currentRival: string | null;
  weekTrainingStats: Map<string, WeeklyTrainingStats>;
  weekTrainingCount: number;
  gridStartsCountMap: Map<string, number>;
  /** Players not available for this match (playerId → reason). */
  matchUnavailable: Map<string, MatchUnavailability>;
  /** Team's deconvocation rules; the default set when omitted. */
  rules?: DeconvocationRuleConfig[];
};

export function useConvocationProposal(input: UseConvocationProposalInput): DeconvokeProposal {
  const {
    players,
    squadIds,
    alreadyOutIds,
    ratings,
    playerStreaks,
    playerTechnicalTotals,
    seasonEvents,
    seasonColumns,
    enrichedGrid,
    seasonStats,
    lastInjuryEndMap,
    lastInjuryStartMap,
    lastInjuryMissedEventsMap,
    currentDate,
    currentEventId,
    currentRival,
    weekTrainingStats,
    weekTrainingCount,
    gridStartsCountMap,
    matchUnavailable,
    rules,
  } = input;

  return useMemo(
    () =>
      buildDeconvokeProposal({
        players,
        calledIds: squadIds,
        alreadyOutIds,
        ratings,
        streaks: playerStreaks,
        technicalTotals: playerTechnicalTotals,
        seasonEvents,
        seasonColumns,
        enrichedGrid,
        seasonStats,
        lastInjuryEndMap,
        lastInjuryStartMap,
        lastInjuryMissedEventsMap,
        currentDate,
        currentEventId,
        currentRival,
        weekTrainingStats,
        weekTrainingCount,
        maxCalledPlayers: 18,
        gridStartsCountMap,
        matchUnavailable,
        rules,
      }),
    [
      players,
      squadIds,
      alreadyOutIds,
      ratings,
      playerStreaks,
      playerTechnicalTotals,
      seasonEvents,
      seasonColumns,
      enrichedGrid,
      seasonStats,
      lastInjuryEndMap,
      lastInjuryStartMap,
      lastInjuryMissedEventsMap,
      currentDate,
      currentEventId,
      currentRival,
      weekTrainingStats,
      weekTrainingCount,
      gridStartsCountMap,
      matchUnavailable,
      rules,
    ],
  );
}
