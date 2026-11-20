import type { MatchPrediction, RivalSimulation } from "../../../services/matchForecastService";
import { classifyRivalDifficulty, type DifficultyThresholds, type RivalDifficulty } from "./deconvocationFunnel";
import { resolveRule, type DeconvocationRuleConfig } from "./rules/ruleCatalog";

function normalize(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const CLUB_WORDS = new Set(["cf", "fc", "cd", "ud", "ad", "sd", "cp", "club", "deportivo", "futbol"]);

/** Name without accents, dots or club abbreviations (C.F., CD, UD...), to compare federation names. */
function clubKey(value: string | null | undefined): string {
  return normalize(value)
    .replace(/[.,'"()-]/g, "")
    .split(" ")
    .filter((word) => word && !CLUB_WORDS.has(word))
    .join(" ");
}

function sameClub(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = clubKey(a);
  const y = clubKey(b);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

function ownMatchesOf(simulation: RivalSimulation): MatchPrediction[] {
  const own = simulation.ownTeamCode;
  return simulation.matches
    .filter((m) => m.localTeamCode === own || m.visitorTeamCode === own)
    .sort((a, b) => a.round - b.round);
}

function isoDay(value: string | null | undefined): string | null {
  return value && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null;
}

/** The own match being prepared: the one against the rival by name, else the first one from the match date. */
function currentMatchIndex(
  simulation: RivalSimulation,
  rivalName: string | null | undefined,
  currentDate: string | null | undefined,
): number {
  const own = simulation.ownTeamCode;
  const matches = ownMatchesOf(simulation);
  const byName = matches.findIndex((m) => sameClub(m.localTeamCode === own ? m.visitorTeamName : m.localTeamName, rivalName));
  if (byName >= 0) return byName;
  const day = isoDay(currentDate);
  if (!day) return -1;
  return matches.findIndex((m) => {
    const matchDay = isoDay(m.date);
    return matchDay != null && matchDay >= day;
  });
}

function ownWinProbability(match: MatchPrediction, own: string): number {
  return match.localTeamCode === own ? match.localWinProbability : match.visitorWinProbability;
}

/** Probability that the own team wins its nearest match against the rival, or null when unknown. */
export function ownWinProbabilityAgainst(
  simulation: RivalSimulation | null | undefined,
  rivalName: string | null | undefined,
  currentDate?: string | null,
): number | null {
  if (!simulation || !simulation.ownTeamCode || (!clubKey(rivalName) && !isoDay(currentDate))) return null;
  const index = currentMatchIndex(simulation, rivalName, currentDate);
  if (index < 0) return null;
  return ownWinProbability(ownMatchesOf(simulation)[index], simulation.ownTeamCode);
}

/** How many matches after the current one the proposal looks ahead. */
export const UPCOMING_MATCHES_LOOKAHEAD = 5;

/**
 * Difficulty of the own team's next matches after the current one, in matchday order; empty when
 * the forecast or the current match is unknown.
 */
export function upcomingDifficulties(
  simulation: RivalSimulation | null | undefined,
  rivalName: string | null | undefined,
  thresholds: DifficultyThresholds,
  count: number = UPCOMING_MATCHES_LOOKAHEAD,
  currentDate?: string | null,
): RivalDifficulty[] {
  if (!simulation || !simulation.ownTeamCode || (!clubKey(rivalName) && !isoDay(currentDate))) return [];
  const index = currentMatchIndex(simulation, rivalName, currentDate);
  if (index < 0) return [];
  const own = simulation.ownTeamCode;
  return ownMatchesOf(simulation)
    .slice(index + 1, index + 1 + count)
    .map((m) => classifyRivalDifficulty(ownWinProbability(m, own), thresholds));
}

/** Thresholds of the team's difficulty rule as probabilities; null when the rule was removed. */
export function difficultyThresholdsFromRules(rules: DeconvocationRuleConfig[]): DifficultyThresholds | null {
  const rule = resolveRule("rivalDifficulty", rules);
  if (!rule) return null;
  return { hardBelow: rule.points.hardBelow / 100, easyAbove: rule.points.easyAbove / 100 };
}
