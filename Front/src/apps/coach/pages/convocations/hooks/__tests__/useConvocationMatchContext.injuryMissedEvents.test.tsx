import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useConvocationMatchContext } from "../useConvocationMatchContext";
import type { PlayerResponse } from "../../../../services/teamplayerService";

const getTeamInjuriesMock = vi.fn();
const getTrainingAttendanceSummaryMock = vi.fn();
const getSportEventsMock = vi.fn();

vi.mock("../../../../services/teamplayerService", () => ({
  getTeamInjuries: (...args: unknown[]) => getTeamInjuriesMock(...args),
  getPlayersByTeam: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../../../services/liveMatchService", () => ({
  getSeasonPlayerStats: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../../../../federation/services/federationApi", () => ({
  getSettingsForUser: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../../../services/federationService", () => ({
  default: { getTeamGoleadores: vi.fn().mockResolvedValue([]) },
}));

vi.mock("../../../../services/attendanceSummaryService", () => ({
  default: { getTrainingAttendanceSummary: (...args: unknown[]) => getTrainingAttendanceSummaryMock(...args) },
}));

vi.mock("../../../../services/sportEventTypeService", () => ({
  default: { getSportEventTypes: vi.fn().mockResolvedValue([{ id: 1, name: "Partido" }, { id: 2, name: "Entrenamiento" }]) },
}));

vi.mock("../../../../services/sportEventService", () => ({
  default: { getSportEvents: (...args: unknown[]) => getSportEventsMock(...args) },
}));

vi.mock("../../../../services/idealLineupService", () => ({
  getIdealLineup: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../../../services/convocationService", () => ({
  default: {},
}));

const buildPlayer = (id: string): PlayerResponse => ({ id, name: id, alias: id });

describe("useConvocationMatchContext - eventos perdidos durante la lesión", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTeamInjuriesMock.mockResolvedValue([
      { teamPlayerId: "p1", injuries: [{ id: "i1", startDate: "2026-09-10", injuryType: "Muscular", endDate: "2026-09-20" }] },
      { teamPlayerId: "p2", injuries: [{ id: "i2", startDate: "2026-08-01", injuryType: "Muscular", endDate: "2026-08-05" }] },
      { teamPlayerId: "p3", injuries: [{ id: "i3", startDate: "2026-09-10", injuryType: "Muscular", endDate: "2026-09-20" }] },
    ]);
    getTrainingAttendanceSummaryMock.mockResolvedValue({
      players: [
        { teamPlayerId: "p1", absences: [{ eventId: "t1", date: "2026-09-15T19:00:00" }] },
        { teamPlayerId: "p2", absences: [] },
        { teamPlayerId: "p3", absences: [] },
      ],
    });
    getSportEventsMock.mockResolvedValue({
      items: [{ id: "m1", eventTypeId: 1, eventType: "Partido", start: "2026-09-13T10:00:00" }],
      totalPages: 1,
    });
  });

  it("cuenta entrenamientos y partidos perdidos durante la última lesión de cada jugador", async () => {
    const players = [buildPlayer("p1"), buildPlayer("p2"), buildPlayer("p3")];

    const { result } = renderHook(() =>
      useConvocationMatchContext("team-1", "2026-09-27", null, players),
    );

    await waitFor(() => {
      expect(result.current.lastInjuryMissedEventsMap.get("p1")).toBe(2);
    });
    expect(result.current.lastInjuryMissedEventsMap.get("p2")).toBe(0);
    expect(result.current.lastInjuryMissedEventsMap.get("p3")).toBe(1);
  });

  it("solo tiene en cuenta los entrenamientos de los 7 días previos al partido", async () => {
    renderHook(() =>
      useConvocationMatchContext("team-1", "2026-09-27", null, [buildPlayer("p1")]),
    );

    await waitFor(() => {
      expect(getSportEventsMock).toHaveBeenCalledWith("team-1", 1, 200, "2026-09-20", "2026-09-26", false);
    });
  });

  it("no informa eventos perdidos si no se pudo cargar la asistencia a entrenamientos", async () => {
    getTrainingAttendanceSummaryMock.mockRejectedValue(new Error("boom"));
    const players = [buildPlayer("p1")];

    const { result } = renderHook(() =>
      useConvocationMatchContext("team-1", "2026-09-27", null, players),
    );

    await waitFor(() => {
      expect(result.current.loadingProposalContext).toBe(false);
      expect(result.current.lastInjuryEndMap.get("p1")).toBe("2026-09-20");
    });
    expect(result.current.lastInjuryMissedEventsMap.has("p1")).toBe(false);
  });
});
