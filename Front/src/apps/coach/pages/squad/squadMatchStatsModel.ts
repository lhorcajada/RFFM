import type { LeaguePlayerStats } from "../../services/leagueStatsService";
import type { PlayerStatistics } from "../../services/teamPlayerStatisticsService";

export type LeagueColumns = {
  callUps: number;
  starts: number;
  goals: number;
  yellowCards: number;
  redCards: number;
  minutesPlayed: number;
};

export type OtherMatchColumns = {
  goals: number;
  yellowCards: number;
  redCards: number;
  minutesPlayed: number;
};

export type RosterInfo = {
  alias?: string | null;
  position?: string | null;
  dominantFoot?: string | null;
};

export type SquadMatchStatsRow = {
  teamPlayerId: string;
  dorsal: number | null;
  name: string;
  alias: string | null;
  position: string | null;
  dominantFoot: string | null;
  league: LeagueColumns;
  /** Amistosos y torneos: total de la temporada menos la liga. */
  other: OtherMatchColumns;
};

const nonNegative = (n: number): number => Math.max(0, n);

export function buildSquadMatchStatsRows(
  players: PlayerStatistics[],
  leagueByPlayer: Record<string, LeaguePlayerStats>,
  rosterById: Record<string, RosterInfo> = {},
): SquadMatchStatsRow[] {
  return players
    .map((p) => {
      const l = leagueByPlayer[p.teamPlayerId];
      const r = rosterById[p.teamPlayerId];
      const league: LeagueColumns = {
        callUps: l?.callUps ?? 0,
        starts: l?.starts ?? 0,
        goals: l?.goals ?? 0,
        yellowCards: l?.yellowCards ?? 0,
        redCards: l?.redCards ?? 0,
        minutesPlayed: l?.minutesPlayed ?? 0,
      };
      return {
        teamPlayerId: p.teamPlayerId,
        dorsal: p.dorsal,
        name: p.displayName,
        alias: r?.alias?.trim() || null,
        position: r?.position?.trim() || p.position,
        dominantFoot: r?.dominantFoot?.trim() || null,
        league,
        other: {
          goals: nonNegative(p.goals - league.goals),
          yellowCards: nonNegative(p.yellowCards - league.yellowCards),
          redCards: nonNegative(p.redCards - league.redCards),
          minutesPlayed: nonNegative(p.minutesPlayed - league.minutesPlayed),
        },
      };
    })
    .sort((a, b) => {
      if (a.dorsal == null && b.dorsal == null) return a.name.localeCompare(b.name, "es");
      if (a.dorsal == null) return 1;
      if (b.dorsal == null) return -1;
      return a.dorsal - b.dorsal;
    });
}

export function playerInfoLines(row: SquadMatchStatsRow): { title: string; detail: string } {
  return {
    title: [row.name, row.alias ? `Alias: ${row.alias}` : ""].filter(Boolean).join(" · "),
    detail: [
      row.dorsal != null ? `Dorsal ${row.dorsal}` : "",
      row.position ? `Posición: ${row.position}` : "",
      row.dominantFoot ? `Pie dominante: ${row.dominantFoot}` : "",
    ]
      .filter(Boolean)
      .join(" · "),
  };
}
