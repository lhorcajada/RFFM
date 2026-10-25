import type { CalendarMatch } from "../../../../federation/types/calendarMatchDay";

export type Outcome = "V" | "E" | "D";

export type OwnRoundEntry = CalendarMatch | "bye";

export type SeasonSummary = {
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
};

const norm = (value: unknown) => String(value ?? "").trim();

const goals = (value: unknown): number | null => {
  const s = norm(value);
  return /^\d+$/.test(s) ? Number(s) : null;
};

export function isOwnMatch(match: CalendarMatch, teamCode: string | null | undefined): boolean {
  const code = norm(teamCode);
  if (!code) return false;
  return norm(match.localTeamCode) === code || norm(match.visitorTeamCode) === code;
}

const SUSPENDED_STATUS = "3";

export function isSuspended(match: CalendarMatch): boolean {
  return norm(match.status) === SUSPENDED_STATUS;
}

export function isPlayed(match: CalendarMatch): boolean {
  return !isSuspended(match) && goals(match.localGoals) !== null && goals(match.visitorGoals) !== null;
}

export function isBye(match: CalendarMatch): boolean {
  return [match.localTeamName, match.visitorTeamName].some((name) => norm(name).toLowerCase() === "descansa");
}

export function ownScore(match: CalendarMatch, teamCode: string | null | undefined): { mine: number; theirs: number } | null {
  if (!isOwnMatch(match, teamCode) || !isPlayed(match)) return null;
  const local = goals(match.localGoals) as number;
  const visitor = goals(match.visitorGoals) as number;
  const isHome = norm(match.localTeamCode) === norm(teamCode);
  return isHome ? { mine: local, theirs: visitor } : { mine: visitor, theirs: local };
}

export function ownOutcome(match: CalendarMatch, teamCode: string | null | undefined): Outcome | null {
  const score = ownScore(match, teamCode);
  if (!score) return null;
  if (score.mine > score.theirs) return "V";
  if (score.mine < score.theirs) return "D";
  return "E";
}

export function splitRound(
  matches: CalendarMatch[],
  teamCode: string | null | undefined,
): { own: CalendarMatch | null; ownBye: boolean; rest: CalendarMatch[] } {
  let own: CalendarMatch | null = null;
  let ownBye = false;
  const rest: CalendarMatch[] = [];
  const byes: CalendarMatch[] = [];
  for (const m of matches) {
    const mine = isOwnMatch(m, teamCode);
    if (isBye(m)) {
      if (mine) ownBye = true;
      else byes.push(m);
    } else if (mine && !own) {
      own = m;
    } else {
      rest.push(m);
    }
  }
  return { own, ownBye: ownBye && !own, rest: [...rest, ...byes] };
}

export function seasonSummary(
  ownByRound: Record<number, OwnRoundEntry>,
  teamCode: string | null | undefined,
): SeasonSummary {
  const summary: SeasonSummary = { wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 };
  for (const entry of Object.values(ownByRound)) {
    if (entry === "bye") continue;
    const score = ownScore(entry, teamCode);
    if (!score) continue;
    summary.goalsFor += score.mine;
    summary.goalsAgainst += score.theirs;
    if (score.mine > score.theirs) summary.wins += 1;
    else if (score.mine < score.theirs) summary.losses += 1;
    else summary.draws += 1;
  }
  return summary;
}
