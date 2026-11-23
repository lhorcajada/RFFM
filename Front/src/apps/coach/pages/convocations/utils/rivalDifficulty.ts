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

function rivalTeamCode(match: MatchPrediction, own: string): string {
  return match.localTeamCode === own ? match.visitorTeamCode : match.localTeamCode;
}

function leaguePositionOf(simulation: RivalSimulation, teamCode: string): number | null {
  return simulation.standings?.find((s) => s.teamCode === teamCode)?.currentPosition ?? null;
}

/** League table position of the rival of the nearest own match against it, or null when unknown. */
export function rivalPositionAgainst(
  simulation: RivalSimulation | null | undefined,
  rivalName: string | null | undefined,
  currentDate?: string | null,
): number | null {
  if (!simulation || !simulation.ownTeamCode || (!clubKey(rivalName) && !isoDay(currentDate))) return null;
  const index = currentMatchIndex(simulation, rivalName, currentDate);
  if (index < 0) return null;
  return leaguePositionOf(simulation, rivalTeamCode(ownMatchesOf(simulation)[index], simulation.ownTeamCode));
}

/** How many matches after the current one the proposal looks ahead. */
export const UPCOMING_MATCHES_LOOKAHEAD = 5;

export type UpcomingMatch = {
  /** Synthetic id of a match that is not a real event yet. */
  eventId: string;
  round: number;
  /** Short label of the matchday, e.g. "J12". */
  label: string;
  date: string;
  rival: string;
  difficulty: RivalDifficulty;
  /** Probability that the own team wins the match, from the forecast. */
  winProbability: number;
  /** League table position of the rival; null when it is not in the standings. */
  rivalPosition: number | null;
};

/**
 * The own team's league matches after the current one, in matchday order, with their rival and difficulty;
 * empty when the forecast or the current match is unknown.
 */
export function upcomingMatchesAfter(
  simulation: RivalSimulation | null | undefined,
  rivalName: string | null | undefined,
  thresholds: DifficultyThresholds,
  count: number = UPCOMING_MATCHES_LOOKAHEAD,
  currentDate?: string | null,
): UpcomingMatch[] {
  if (!simulation || !simulation.ownTeamCode || (!clubKey(rivalName) && !isoDay(currentDate))) return [];
  const index = currentMatchIndex(simulation, rivalName, currentDate);
  if (index < 0) return [];
  const own = simulation.ownTeamCode;
  return ownMatchesOf(simulation)
    .slice(index + 1, index + 1 + count)
    .map((m) => ({
      eventId: `upcoming-${m.round}`,
      round: m.round,
      label: `J${m.round}`,
      date: isoDay(m.date) ?? "",
      rival: m.localTeamCode === own ? m.visitorTeamName : m.localTeamName,
      difficulty: classifyRivalDifficulty(ownWinProbability(m, own), thresholds),
      winProbability: ownWinProbability(m, own),
      rivalPosition: leaguePositionOf(simulation, rivalTeamCode(m, own)),
    }));
}

/** Difficulty of the matches after the current one, in matchday order; empty when unknown. */
export function upcomingDifficulties(
  simulation: RivalSimulation | null | undefined,
  rivalName: string | null | undefined,
  thresholds: DifficultyThresholds,
  count: number = UPCOMING_MATCHES_LOOKAHEAD,
  currentDate?: string | null,
): RivalDifficulty[] {
  return upcomingMatchesAfter(simulation, rivalName, thresholds, count, currentDate).map((m) => m.difficulty);
}

/** Thresholds of the team's difficulty rule as probabilities; null when the rule was removed. */
export function difficultyThresholdsFromRules(rules: DeconvocationRuleConfig[]): DifficultyThresholds | null {
  const rule = resolveRule("rivalDifficulty", rules);
  if (!rule) return null;
  return { hardBelow: rule.points.hardBelow / 100, easyAbove: rule.points.easyAbove / 100 };
}
