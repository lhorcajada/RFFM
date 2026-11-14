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

export type SquadMatchStatsRow = {
  teamPlayerId: string;
  dorsal: number | null;
  name: string;
  position: string | null;
  league: LeagueColumns;
  /** Amistosos y torneos: total de la temporada menos la liga. */
  other: OtherMatchColumns;
};

const nonNegative = (n: number): number => Math.max(0, n);

export function buildSquadMatchStatsRows(
  players: PlayerStatistics[],
  leagueByPlayer: Record<string, LeaguePlayerStats>,
): SquadMatchStatsRow[] {
  return players
    .map((p) => {
      const l = leagueByPlayer[p.teamPlayerId];
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
        position: p.position,
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
