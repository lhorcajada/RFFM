import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useConvocationMatchContext } from "../useConvocationMatchContext";
import type { PlayerResponse } from "../../../../services/teamplayerService";

const getTrainingAttendanceSummaryMock = vi.fn();
const getSportEventsMock = vi.fn();

vi.mock("../../../../services/teamplayerService", () => ({
  getTeamInjuries: vi.fn().mockResolvedValue([]),
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
  default: { getSportEventTypes: vi.fn().mockResolvedValue([{ id: 2, name: "Entrenamiento" }]) },
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

describe("useConvocationMatchContext - entrenamientos previos al partido", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-07T12:00:00"));
    getTrainingAttendanceSummaryMock.mockResolvedValue({
      players: [{ teamPlayerId: "p1", absences: [{ eventId: "t1", date: "2026-10-06T19:00:00" }] }],
    });
    getSportEventsMock.mockResolvedValue({
      items: [
        { id: "t1", eventTypeId: 2, eventType: "Entrenamiento", start: "2026-10-06T19:00:00" },
        { id: "t2", eventTypeId: 2, eventType: "Entrenamiento", start: "2026-10-07T19:00:00" },
        { id: "t3", eventTypeId: 2, eventType: "Entrenamiento", start: "2026-10-08T19:00:00" },
      ],
      totalPages: 1,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("no cuenta como asistidos los entrenamientos que aún no se han celebrado", async () => {
    const { result } = renderHook(() =>
      useConvocationMatchContext("team-1", "2026-10-10", null, [buildPlayer("p1")]),
    );

    await waitFor(() => {
      expect(result.current.weekTrainingStatsMap.get("p1")).toMatchObject({
        totalTrainings: 1,
        attendedTrainings: 0,
      });
    });
    expect(result.current.weekTrainingCount).toBe(1);
  });

  it.each([
    [2, "Estudios"],
    [4, "Problema familiar"],
    [9, "Cita médica"],
    [10, "Imprevisto"],
  ])("no cuenta en la ventana ni en la temporada una falta por %s", async (excuseTypeId) => {
    getTrainingAttendanceSummaryMock.mockResolvedValue({
      players: [{
        teamPlayerId: "p1",
        attendedTrainings: 9,
        totalTrainings: 10,
        absences: [{ eventId: "t1", date: "2026-10-06T19:00:00", excuseTypeId }],
      }],
    });

    const { result } = renderHook(() =>
      useConvocationMatchContext("team-1", "2026-10-10", null, [buildPlayer("p1")]),
    );

    await waitFor(() => {
      expect(result.current.weekTrainingStatsMap.get("p1")).toMatchObject({
        totalTrainings: 0,
        attendedTrainings: 0,
        knownUnavailableTrainings: 0,
        attendedTrainingsSeason: 9,
        totalTrainingsSeason: 9,
      });
    });
  });

  it("sí cuenta una falta por enfermedad", async () => {
    getTrainingAttendanceSummaryMock.mockResolvedValue({
      players: [{
        teamPlayerId: "p1",
        attendedTrainings: 9,
        totalTrainings: 10,
        absences: [{ eventId: "t1", date: "2026-10-06T19:00:00", excuseTypeId: 3 }],
      }],
    });

    const { result } = renderHook(() =>
      useConvocationMatchContext("team-1", "2026-10-10", null, [buildPlayer("p1")]),
    );

    await waitFor(() => {
      expect(result.current.weekTrainingStatsMap.get("p1")).toMatchObject({
        totalTrainings: 1,
        knownUnavailableTrainings: 1,
        totalTrainingsSeason: 10,
      });
    });
  });
});
