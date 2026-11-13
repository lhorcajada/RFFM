import type { RivalSimulation } from "../../../services/matchForecastService";
import type { DifficultyThresholds } from "./deconvocationFunnel";
import { resolveRule, type DeconvocationRuleConfig } from "./rules/ruleCatalog";

function normalize(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Probability that the own team wins its nearest match against the rival, or null when unknown. */
export function ownWinProbabilityAgainst(
  simulation: RivalSimulation | null | undefined,
  rivalName: string | null | undefined,
): number | null {
  const rival = normalize(rivalName);
  if (!simulation || !rival || !simulation.ownTeamCode) return null;
  const own = simulation.ownTeamCode;
  const candidates = simulation.matches
    .filter((m) => {
      if (m.localTeamCode === own) return normalize(m.visitorTeamName) === rival;
      if (m.visitorTeamCode === own) return normalize(m.localTeamName) === rival;
      return false;
    })
    .sort((a, b) => a.round - b.round);
  const next = candidates[0];
  if (!next) return null;
  return next.localTeamCode === own ? next.localWinProbability : next.visitorWinProbability;
}

/** Thresholds of the team's difficulty rule as probabilities; null when the rule was removed. */
export function difficultyThresholdsFromRules(rules: DeconvocationRuleConfig[]): DifficultyThresholds | null {
  const rule = resolveRule("rivalDifficulty", rules);
  if (!rule) return null;
  return { hardBelow: rule.points.hardBelow / 100, easyAbove: rule.points.easyAbove / 100 };
}
