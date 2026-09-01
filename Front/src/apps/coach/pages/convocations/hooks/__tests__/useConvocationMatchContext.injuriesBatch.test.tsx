import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useConvocationMatchContext } from "../useConvocationMatchContext";
import type { PlayerResponse } from "../../../../services/teamplayerService";

const getPlayerInjuriesMock = vi.fn();
const getTeamInjuriesMock = vi.fn();
const getPlayersByTeamMock = vi.fn();

vi.mock("../../../../services/teamplayerService", () => ({
  getPlayerInjuries: (...args: unknown[]) => getPlayerInjuriesMock(...args),
  getTeamInjuries: (...args: unknown[]) => getTeamInjuriesMock(...args),
  getPlayersByTeam: (...args: unknown[]) => getPlayersByTeamMock(...args),
}));

vi.mock("../../../../services/liveMatchService", () => ({
  getSeasonPlayerStats: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../../../../federation/services/federationApi", () => ({
  getSettingsForUser: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../../../services/federationService", () => ({
  default: { getTeamGoleadores: vi.fn().mockResolvedValue([]) },
  getTeamGoleadores: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../../../services/attendanceSummaryService", () => ({
  default: { getTrainingAttendanceSummary: vi.fn().mockResolvedValue(null) },
  getTrainingAttendanceSummary: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../../../services/sportEventTypeService", () => ({
  default: { getSportEventTypes: vi.fn().mockResolvedValue([]) },
  getSportEventTypes: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../../../services/convocationService", () => ({
  default: {},
}));

const buildPlayer = (id: string): PlayerResponse => ({
  id,
  name: id,
  alias: id,
});

describe("useConvocationMatchContext - lesiones", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTeamInjuriesMock.mockResolvedValue([
      { teamPlayerId: "p1", injuries: [{ id: "i1", startDate: "2026-01-01", injuryType: "Muscular", endDate: "2026-01-10" }] },
      { teamPlayerId: "p2", injuries: [] },
    ]);
  });

  it("pide las lesiones de todo el equipo en una sola llamada, en vez de una por jugador", async () => {
    const players = [buildPlayer("p1"), buildPlayer("p2")];

    const { result } = renderHook(() =>
      useConvocationMatchContext("team-1", undefined, null, players)
    );

    await waitFor(() => {
      expect(result.current.lastInjuryEndMap.get("p1")).toBe("2026-01-10");
    });

    expect(getTeamInjuriesMock).toHaveBeenCalledTimes(1);
    expect(getTeamInjuriesMock).toHaveBeenCalledWith("team-1");
    expect(getPlayerInjuriesMock).not.toHaveBeenCalled();
    expect(result.current.lastInjuryEndMap.get("p2")).toBe(null);
  });

  it("no pide nada cuando enabled es false", async () => {
    const players = [buildPlayer("p1"), buildPlayer("p2")];

    renderHook(() =>
      useConvocationMatchContext("team-1", "2026-09-01", null, players, false)
    );

    await new Promise((r) => setTimeout(r, 20));

    expect(getTeamInjuriesMock).not.toHaveBeenCalled();
    expect(getPlayersByTeamMock).not.toHaveBeenCalled();
  });
});
