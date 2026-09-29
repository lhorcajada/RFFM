import { useEffect, useState } from "react";
import {
  getCalendar,
  getTeamsForClassification,
} from "../../apps/federation/services/api";

export type ClassificationTeam = {
  teamId: string;
  teamName: string;
  position: number;
  points: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  matchStreaks?: { type?: string }[];
};

export type ClassificationTeamMatch = {
  date: string | null;
  opponent: string;
  result: "G" | "E" | "P";
  localGoals: number | null;
  visitorGoals: number | null;
  isLocal: boolean;
  scoreLeft: string;
  scoreRight: string;
};

type UseClassificationParams = {
  season: string;
  competition?: string;
  group?: string;
};

type RawMatch = Record<string, unknown>;

type ParsedMatch = {
  date: string | null;
  localId: string;
  visitorId: string;
  localName: string;
  visitorName: string;
  localGoals: number;
  visitorGoals: number;
};

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function goals(...values: unknown[]): number {
  const found = values.find((v) => v !== undefined && v !== null);
  return Number(found ?? NaN);
}

function parseMatchDaysMatch(m: RawMatch, date: string | null): ParsedMatch {
  return {
    date,
    localId: text(m.localTeamCode ?? m.localTeamId),
    visitorId: text(m.visitorTeamCode ?? m.visitorTeamId),
    localName: text(m.localTeamName),
    visitorName: text(m.visitorTeamName),
    localGoals: goals(m.localGoals, m.LocalGoals, m.goles_casa, m.goles),
    visitorGoals: goals(m.visitorGoals, m.VisitorGoals, m.goles_visitante, m.goles_v),
  };
}

function parseLegacyRoundMatch(m: RawMatch): ParsedMatch {
  return {
    date: (m.fecha ?? m.date ?? null) as string | null,
    localId: text(m.codigo_equipo_local ?? m.codigo_local ?? m.localTeamId),
    visitorId: text(m.codigo_equipo_visitante ?? m.codigo_visitante ?? m.awayTeamId),
    localName: text(m.equipo_local ?? m.localTeamName ?? m.local),
    visitorName: text(m.equipo_visitante ?? m.awayTeamName ?? m.visitante),
    localGoals: goals(m.goles_casa, m.LocalGoals, m.goles),
    visitorGoals: goals(m.goles_visitante, m.AwayGoals, m.goles_v),
  };
}

function toTeamMatch(match: ParsedMatch, isLocal: boolean): ClassificationTeamMatch {
  const { localGoals, visitorGoals } = match;
  const hasScore = !Number.isNaN(localGoals) && !Number.isNaN(visitorGoals);
  let result: "G" | "E" | "P" = "E";
  if (hasScore && localGoals !== visitorGoals) {
    const localWon = localGoals > visitorGoals;
    result = localWon === isLocal ? "G" : "P";
  }
  const localText = Number.isNaN(localGoals) ? "" : String(localGoals);
  const visitorText = Number.isNaN(visitorGoals) ? "" : String(visitorGoals);
  return {
    date: match.date,
    opponent: isLocal ? match.visitorName || match.visitorId : match.localName || match.localId,
    result,
    localGoals: Number.isNaN(localGoals) ? null : localGoals,
    visitorGoals: Number.isNaN(visitorGoals) ? null : visitorGoals,
    isLocal,
    scoreLeft: isLocal ? localText : visitorText,
    scoreRight: isLocal ? visitorText : localText,
  };
}

function parseCalendar(calData: unknown): ParsedMatch[] {
  const data = (calData ?? {}) as {
    matchDays?: { date?: string; matches?: RawMatch[] }[];
    rounds?: Record<string, unknown>[];
  };
  if (data.matchDays) {
    return data.matchDays.flatMap((day) =>
      (day.matches ?? []).map((m) => parseMatchDaysMatch(m, day.date ?? null)),
    );
  }
  if (data.rounds) {
    return data.rounds.flatMap((r) =>
      ((r.equipos ?? r.partidos ?? r.matches ?? []) as RawMatch[]).map(parseLegacyRoundMatch),
    );
  }
  return [];
}

export function buildTeamMatches(calData: unknown): Record<string, ClassificationTeamMatch[]> {
  const map: Record<string, ClassificationTeamMatch[]> = {};
  const push = (key: string, entry: ClassificationTeamMatch) => {
    if (!key) return;
    (map[key] = map[key] || []).push(entry);
  };
  for (const match of parseCalendar(calData)) {
    push(match.localId || match.localName, toTeamMatch(match, true));
    push(match.visitorId || match.visitorName, toTeamMatch(match, false));
  }
  return map;
}

export default function useClassification({ season, competition, group }: UseClassificationParams) {
  const [teams, setTeams] = useState<ClassificationTeam[]>([]);
  const [teamMatches, setTeamMatches] = useState<Record<string, ClassificationTeamMatch[]>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!competition || !group) {
        setTeams([]);
        setTeamMatches({});
        return;
      }

      setLoading(true);
      try {
        const params = { season, competition, group, playType: "1" };
        const [teamsData, calData] = await Promise.all([
          getTeamsForClassification(params),
          getCalendar(params),
        ]);
        if (cancelled) return;
        // The backend applies the federation tie-breakers; sorting by points alone would undo them.
        const sorted = ((teamsData || []) as ClassificationTeam[])
          .slice()
          .sort((a, b) =>
            a.position > 0 && b.position > 0 ? a.position - b.position : b.points - a.points,
          );
        setTeams(sorted);
        try {
          setTeamMatches(buildTeamMatches(calData));
        } catch {
          setTeamMatches({});
        }
      } catch {
        if (cancelled) return;
        setTeams([]);
        setTeamMatches({});
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [season, competition, group]);

  return { teams, teamMatches, loading };
}
