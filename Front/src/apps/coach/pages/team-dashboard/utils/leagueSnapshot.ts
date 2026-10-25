import type { ClassificationTeam } from "../../../../../shared/hooks/useClassification";
import { ownOutcome, ownScore, type Outcome, type OwnRoundEntry } from "../../results/utils/ownMatch";

export type LeagueSnapshot = {
  position: number;
  points: number;
  lastMatch: { round: number; opponent: string; mine: number; theirs: number; outcome: Outcome } | null;
  form: Outcome[];
};

const FORM_LENGTH = 5;

export function buildLeagueSnapshot(
  teams: ClassificationTeam[],
  ownByRound: Record<number, OwnRoundEntry>,
  ownTeamCode: string | null,
): LeagueSnapshot | null {
  if (!ownTeamCode) return null;
  const own = teams.find((t) => String(t.teamId) === ownTeamCode);
  if (!own) return null;

  const played = Object.entries(ownByRound)
    .map(([round, entry]) => ({ round: Number(round), entry }))
    .sort((a, b) => a.round - b.round)
    .flatMap(({ round, entry }) => {
      if (entry === "bye") return [];
      const score = ownScore(entry, ownTeamCode);
      const outcome = ownOutcome(entry, ownTeamCode);
      if (!score || !outcome) return [];
      const isHome = String(entry.localTeamCode).trim() === ownTeamCode;
      const opponent = isHome ? entry.visitorTeamName : entry.localTeamName;
      return [{ round, opponent, mine: score.mine, theirs: score.theirs, outcome }];
    });

  return {
    position: own.position,
    points: own.points,
    lastMatch: played[played.length - 1] ?? null,
    form: played.slice(-FORM_LENGTH).map((m) => m.outcome),
  };
}
