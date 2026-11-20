import { useEffect, useMemo, useState } from "react";
import { getRivalSimulation, type RivalSimulation } from "../../../services/matchForecastService";
import { classifyRivalDifficulty, type RivalDifficulty } from "../utils/deconvocationFunnel";
import { difficultyThresholdsFromRules, ownWinProbabilityAgainst, upcomingMatchesAfter, type UpcomingMatch } from "../utils/rivalDifficulty";
import type { DeconvocationRuleConfig } from "../utils/rules/ruleCatalog";

export type RivalOutlook = {
  /** Difficulty of the next rival; medium while loading, without forecast or without the rule. */
  difficulty: RivalDifficulty;
  /** Own win probability against the next rival; null while loading or without forecast. */
  winProbability: number | null;
  /** Difficulty of the matches after it (the next five); empty while loading, without forecast or without the rule. */
  upcoming: RivalDifficulty[];
  /** The next league matches with rival, date and difficulty; same availability as `upcoming`. */
  upcomingMatches: UpcomingMatch[];
};

/** Difficulty of the next rival and of the matches that follow, from the league forecast. */
export function useRivalOutlook(
  teamId: string,
  rivalName: string | null,
  rules: DeconvocationRuleConfig[],
  matchDate?: string | null,
): RivalOutlook {
  const [simulation, setSimulation] = useState<RivalSimulation | null>(null);

  useEffect(() => {
    setSimulation(null);
    if (!teamId || !rivalName) return;
    let mounted = true;
    getRivalSimulation(teamId)
      .then((data) => {
        if (mounted) setSimulation(data);
      })
      .catch(() => {
        if (mounted) setSimulation(null);
      });
    return () => {
      mounted = false;
    };
  }, [teamId, rivalName]);

  return useMemo(() => {
    const thresholds = difficultyThresholdsFromRules(rules);
    if (!thresholds) return { difficulty: "medium", winProbability: null, upcoming: [], upcomingMatches: [] };
    const winProbability = ownWinProbabilityAgainst(simulation, rivalName, matchDate);
    const upcomingMatches = upcomingMatchesAfter(simulation, rivalName, thresholds, undefined, matchDate);
    return {
      difficulty: classifyRivalDifficulty(winProbability, thresholds),
      winProbability,
      upcoming: upcomingMatches.map((m) => m.difficulty),
      upcomingMatches,
    };
  }, [simulation, rivalName, rules, matchDate]);
}

/** Difficulty of the next rival from the league forecast; medium while loading, without forecast or without the rule. */
export function useRivalDifficulty(
  teamId: string,
  rivalName: string | null,
  rules: DeconvocationRuleConfig[],
): RivalDifficulty {
  return useRivalOutlook(teamId, rivalName, rules).difficulty;
}
