import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useConvocationMatchContext } from "../useConvocationMatchContext";
import type { PlayerResponse } from "../../../../services/teamplayerService";

const getTrainingAttendanceSummaryMock = vi.fn();
const getSportEventsMock = vi.fn();
const getTeamConvocationsSummaryMock = vi.fn();

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
  default: {
    getTrainingAttendanceSummary: (...args: unknown[]) => getTrainingAttendanceSummaryMock(...args),
    getTeamConvocationsSummary: (...args: unknown[]) => getTeamConvocationsSummaryMock(...args),
  },
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
    getTeamConvocationsSummaryMock.mockResolvedValue([]);
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
    [2, "Estudios", 0.25],
    [4, "Problema familiar", 0.5],
    [9, "Cita médica", 0.25],
    [10, "Imprevisto", 0.5],
  ])("cuenta en la ventana y en la temporada una falta por %s con su peso", async (excuseTypeId, _name, weighted) => {
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
        totalTrainings: 1,
        attendedTrainings: 0,
        weightedAttendedTrainings: weighted,
        knownUnavailableTrainings: 0,
        attendedTrainingsSeason: 0,
        weightedAttendedTrainingsSeason: weighted,
        totalTrainingsSeason: 1,
      });
    });
  });

  it("una falta por enfermedad cuenta para forzar la desconvocatoria", async () => {
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
        weightedAttendedTrainings: 0.25,
        knownUnavailableTrainings: 1,
        totalTrainingsSeason: 1,
      });
    });
  });

  it("calcula la asistencia de temporada solo con los entrenamientos de la temporada en curso", async () => {
    getTrainingAttendanceSummaryMock.mockResolvedValue({
      players: [{
        teamPlayerId: "p1",
        attendedTrainings: 40,
        totalTrainings: 42,
        absences: [
          { eventId: "t1", date: "2026-10-06T19:00:00" },
          { eventId: "old-season", date: "2026-03-10T19:00:00" },
        ],
      }],
    });
    getSportEventsMock.mockResolvedValue({
      items: [
        { id: "t0", eventTypeId: 2, eventType: "Entrenamiento", start: "2026-09-29T19:00:00" },
        { id: "t1", eventTypeId: 2, eventType: "Entrenamiento", start: "2026-10-06T19:00:00" },
      ],
      totalPages: 1,
    });
    getTeamConvocationsSummaryMock.mockResolvedValue([
      { eventId: "t0", convocationId: "c0", teamPlayerId: "p1", alias: "p1", statusId: 2, excuseTypeId: null, assistanceTypeId: 1 },
      { eventId: "t1", convocationId: "c1", teamPlayerId: "p1", alias: "p1", statusId: 2, excuseTypeId: null, assistanceTypeId: 3 },
      { eventId: "old-attended", convocationId: "c2", teamPlayerId: "p1", alias: "p1", statusId: 2, excuseTypeId: null, assistanceTypeId: 1 },
    ]);

    const { result } = renderHook(() =>
      useConvocationMatchContext("team-1", "2026-10-10", null, [buildPlayer("p1")]),
    );

    await waitFor(() => {
      expect(result.current.weekTrainingStatsMap.get("p1")).toMatchObject({
        attendedTrainingsSeason: 1,
        weightedAttendedTrainingsSeason: 1,
        totalTrainingsSeason: 2,
      });
    });
  });

  it("suma los amistosos jugados de la semana y de la temporada a los eventos posibles", async () => {
    getTrainingAttendanceSummaryMock.mockResolvedValue({
      players: [{ teamPlayerId: "p1", attendedTrainings: 9, totalTrainings: 9, absences: [] }],
    });
    getSportEventsMock.mockResolvedValue({
      items: [
        { id: "f1", eventTypeId: 1, matchCategory: "Friendly", title: "Amistoso", start: "2026-10-04T11:00:00" },
        { id: "f2", eventTypeId: 1, matchCategory: "Friendly", title: "Amistoso", start: "2026-10-05T11:00:00" },
        { id: "t1", eventTypeId: 2, eventType: "Entrenamiento", start: "2026-10-06T19:00:00" },
      ],
      totalPages: 1,
    });
    getTeamConvocationsSummaryMock.mockResolvedValue([
      { eventId: "f1", convocationId: "c1", teamPlayerId: "p1", alias: "p1", statusId: 2, excuseTypeId: null, assistanceTypeId: 1 },
      { eventId: "f2", convocationId: "c2", teamPlayerId: "p1", alias: "p1", statusId: 2, excuseTypeId: 10, assistanceTypeId: 2 },
      { eventId: "t1", convocationId: "c3", teamPlayerId: "p1", alias: "p1", statusId: 2, excuseTypeId: null, assistanceTypeId: 1 },
    ]);

    const { result } = renderHook(() =>
      useConvocationMatchContext("team-1", "2026-10-10", null, [buildPlayer("p1")]),
    );

    await waitFor(() => {
      expect(result.current.weekTrainingStatsMap.get("p1")).toMatchObject({
        totalTrainings: 3,
        attendedTrainings: 2,
        weightedAttendedTrainings: 2.5,
        attendedTrainingsSeason: 2,
        weightedAttendedTrainingsSeason: 2.5,
        totalTrainingsSeason: 3,
      });
    });
  });
});
