import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useConvocationMatchContext } from "../useConvocationMatchContext";
import type { PlayerResponse } from "../../../../services/teamplayerService";

const getSeasonPlayerStatsMock = vi.fn();
const getTeamGoleadoresMock = vi.fn();

vi.mock("../../../../services/teamplayerService", () => ({
  getTeamInjuries: vi.fn().mockResolvedValue([]),
  getPlayersByTeam: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../../../services/liveMatchService", () => ({
  getSeasonPlayerStats: (...args: unknown[]) => getSeasonPlayerStatsMock(...args),
}));

vi.mock("../../../../../federation/services/federationApi", () => ({
  getSettingsForUser: vi.fn().mockResolvedValue([{ isPrimary: true, competitionId: "c1", groupId: "g1", teamId: "t1" }]),
}));

vi.mock("../../../../services/federationService", () => ({
  default: { getTeamGoleadores: (...args: unknown[]) => getTeamGoleadoresMock(...args) },
}));

vi.mock("../../../../services/attendanceSummaryService", () => ({
  default: {
    getTrainingAttendanceSummary: vi.fn().mockResolvedValue({ players: [] }),
    getTeamConvocationsSummary: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../../../../services/sportEventTypeService", () => ({
  default: { getSportEventTypes: vi.fn().mockResolvedValue([{ id: 1, name: "Partido" }, { id: 2, name: "Entrenamiento" }]) },
}));

vi.mock("../../../../services/sportEventService", () => ({
  default: { getSportEvents: vi.fn().mockResolvedValue({ items: [], totalPages: 1 }) },
}));

vi.mock("../../../../services/idealLineupService", () => ({
  getIdealLineup: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../../../services/convocationService", () => ({
  default: {},
}));

const buildPlayer = (id: string, playerId: string): PlayerResponse => ({ id, playerId, name: id, alias: id });

const backendStats = (teamPlayerId: string, totalGoals: number, leagueGoals: number) => ({
  teamPlayerId,
  totalGoals,
  leagueGoals,
  totalMinutes: 0,
  totalStarts: 0,
  totalMatches: 0,
});

describe("useConvocationMatchContext - goles de liga", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("los goleadores RFFM escriben leagueGoals y no tocan totalGoals", async () => {
    getSeasonPlayerStatsMock.mockResolvedValue([backendStats("p1", 5, 1)]);
    getTeamGoleadoresMock.mockResolvedValue([{ playerId: "f1", playerName: "Uno", scores: 3 }]);

    const { result } = renderHook(() =>
      useConvocationMatchContext("team-1", "2026-09-27", null, [buildPlayer("p1", "f1")]),
    );

    await waitFor(() => {
      expect(result.current.seasonStats.find((s) => s.teamPlayerId === "p1")?.leagueGoals).toBe(3);
    });
    expect(result.current.seasonStats.find((s) => s.teamPlayerId === "p1")?.totalGoals).toBe(5);
  });

  it("un jugador que no aparece en los goleadores RFFM conserva el leagueGoals del backend", async () => {
    getSeasonPlayerStatsMock.mockResolvedValue([backendStats("p1", 5, 3), backendStats("p2", 4, 1)]);
    getTeamGoleadoresMock.mockResolvedValue([{ playerId: "f1", playerName: "Uno", scores: 3 }]);

    const { result } = renderHook(() =>
      useConvocationMatchContext("team-1", "2026-09-27", null, [buildPlayer("p1", "f1"), buildPlayer("p2", "f2")]),
    );

    await waitFor(() => {
      expect(result.current.seasonStats.find((s) => s.teamPlayerId === "p1")?.leagueGoals).toBe(3);
    });
    const p2 = result.current.seasonStats.find((s) => s.teamPlayerId === "p2");
    expect(p2?.leagueGoals).toBe(1);
    expect(p2?.totalGoals).toBe(4);
  });

  it("sin estadísticas del backend, leagueGoals toma el valor RFFM o 0", async () => {
    getSeasonPlayerStatsMock.mockResolvedValue([]);
    getTeamGoleadoresMock.mockResolvedValue([{ playerId: "f1", playerName: "Uno", scores: 2 }]);

    const { result } = renderHook(() =>
      useConvocationMatchContext("team-1", "2026-09-27", null, [buildPlayer("p1", "f1"), buildPlayer("p2", "f2")]),
    );

    await waitFor(() => {
      expect(result.current.seasonStats.find((s) => s.teamPlayerId === "p1")?.leagueGoals).toBe(2);
    });
    expect(result.current.seasonStats.find((s) => s.teamPlayerId === "p2")?.leagueGoals).toBe(0);
  });
});
