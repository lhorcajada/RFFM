import { describe, expect, it } from "vitest";
import { buildSquadMatchStatsRows } from "../squadMatchStatsModel";
import type { PlayerStatistics } from "../../../services/teamPlayerStatisticsService";
import type { LeaguePlayerStats } from "../../../services/leagueStatsService";

const player = (over: Partial<PlayerStatistics>): PlayerStatistics =>
  ({
    teamPlayerId: "p1",
    displayName: "Ana Pérez",
    position: "Delantero",
    dorsal: 9,
    goals: 5,
    yellowCards: 3,
    redCards: 1,
    minutesPlayed: 400,
    ...over,
  }) as PlayerStatistics;

const league = (over: Partial<LeaguePlayerStats>): LeaguePlayerStats => ({
  teamPlayerId: "p1",
  goals: 3,
  callUps: 6,
  starts: 4,
  yellowCards: 2,
  redCards: 1,
  minutesPlayed: 300,
  ...over,
});

describe("buildSquadMatchStatsRows", () => {
  it("separa liga de amistosos y torneos restando la liga al total", () => {
    const [row] = buildSquadMatchStatsRows([player({})], { p1: league({}) });

    expect(row.league).toEqual({ callUps: 6, starts: 4, goals: 3, yellowCards: 2, redCards: 1, minutesPlayed: 300 });
    expect(row.other).toEqual({ goals: 2, yellowCards: 1, redCards: 0, minutesPlayed: 100 });
  });

  it("si el jugador no tiene estadísticas de liga, todo cuenta como amistosos y torneos", () => {
    const [row] = buildSquadMatchStatsRows([player({})], {});

    expect(row.league).toEqual({ callUps: 0, starts: 0, goals: 0, yellowCards: 0, redCards: 0, minutesPlayed: 0 });
    expect(row.other).toEqual({ goals: 5, yellowCards: 3, redCards: 1, minutesPlayed: 400 });
  });

  it("nunca da valores negativos si la liga supera al total", () => {
    const [row] = buildSquadMatchStatsRows([player({ goals: 1 })], { p1: league({ goals: 3 }) });

    expect(row.other.goals).toBe(0);
  });

  it("ordena por dorsal y deja sin dorsal al final", () => {
    const rows = buildSquadMatchStatsRows(
      [
        player({ teamPlayerId: "a", displayName: "Sin dorsal", dorsal: null }),
        player({ teamPlayerId: "b", displayName: "Diez", dorsal: 10 }),
        player({ teamPlayerId: "c", displayName: "Siete", dorsal: 7 }),
      ],
      {},
    );

    expect(rows.map((r) => r.name)).toEqual(["Siete", "Diez", "Sin dorsal"]);
  });
});
