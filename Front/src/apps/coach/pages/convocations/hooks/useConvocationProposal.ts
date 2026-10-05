import { useMemo } from "react";
import type { SportEventResponse } from "../../../services/sportEventService";
import type { PlayerResponse } from "../../../services/teamplayerService";
import type { PlayerRating } from "../../../types/playerRating";
import type { GridCell, MatchColumn } from "../components/convocationMatchDetail.types";
import type { SeasonPlayerStats } from "../components/simulation/liveMatch.types";
import type { DeconvokeProposal, WeeklyTrainingStats } from "../utils/deconvokeProposal";
import { buildDeconvokeProposal } from "../utils/deconvokeProposal";

type UseConvocationProposalInput = {
  players: PlayerResponse[];
  /** Whole squad: the proposal picks who to leave out from every player, not only those already called. */
  squadIds: string[];
  ratings: Record<string, PlayerRating>;
  playerStreaks: Map<string, number>;
  playerTechnicalTotals: Map<string, number>;
  seasonEvents: SportEventResponse[];
  seasonColumns: MatchColumn[];
  enrichedGrid: Map<string, Map<string, GridCell>>;
  seasonStats: SeasonPlayerStats[];
  lastInjuryEndMap: Map<string, string | null>;
  currentDate: string | undefined;
  currentEventId: string | null;
  currentRival: string | null;
  weekTrainingStats: Map<string, WeeklyTrainingStats>;
  weekTrainingCount: number;
  gridStartsCountMap: Map<string, number>;
};

export function useConvocationProposal(input: UseConvocationProposalInput): DeconvokeProposal {
  const {
    players,
    squadIds,
    ratings,
    playerStreaks,
    playerTechnicalTotals,
    seasonEvents,
    seasonColumns,
    enrichedGrid,
    seasonStats,
    lastInjuryEndMap,
    currentDate,
    currentEventId,
    currentRival,
    weekTrainingStats,
    weekTrainingCount,
    gridStartsCountMap,
  } = input;

  return useMemo(
    () =>
      buildDeconvokeProposal({
        players,
        calledIds: squadIds,
        ratings,
        streaks: playerStreaks,
        technicalTotals: playerTechnicalTotals,
        seasonEvents,
        seasonColumns,
        enrichedGrid,
        seasonStats,
        lastInjuryEndMap,
        currentDate,
        currentEventId,
        currentRival,
        weekTrainingStats,
        weekTrainingCount,
        maxCalledPlayers: 18,
        gridStartsCountMap,
      }),
    [
      players,
      squadIds,
      ratings,
      playerStreaks,
      playerTechnicalTotals,
      seasonEvents,
      seasonColumns,
      enrichedGrid,
      seasonStats,
      lastInjuryEndMap,
      currentDate,
      currentEventId,
      currentRival,
      weekTrainingStats,
      weekTrainingCount,
      gridStartsCountMap,
    ],
  );
}
