import { useEffect, useMemo, useState } from "react";
import { getRivalSimulation, type RivalSimulation } from "../../../services/matchForecastService";
import { classifyRivalDifficulty, type RivalDifficulty } from "../utils/deconvocationFunnel";
import { difficultyThresholdsFromRules, ownWinProbabilityAgainst } from "../utils/rivalDifficulty";
import type { DeconvocationRuleConfig } from "../utils/rules/ruleCatalog";

/** Difficulty of the next rival from the league forecast; medium while loading, without forecast or without the rule. */
export function useRivalDifficulty(
  teamId: string,
  rivalName: string | null,
  rules: DeconvocationRuleConfig[],
): RivalDifficulty {
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
    if (!thresholds) return "medium";
    return classifyRivalDifficulty(ownWinProbabilityAgainst(simulation, rivalName), thresholds);
  }, [simulation, rivalName, rules]);
}
