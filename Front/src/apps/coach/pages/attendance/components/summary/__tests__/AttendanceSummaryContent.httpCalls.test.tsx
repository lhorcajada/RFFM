import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getConvocationsMock = vi.fn();
vi.mock("../../../../../services/convocationService", () => ({
  default: {
    getEventPlayers: vi.fn(),
    getConvocations: (...args: unknown[]) => getConvocationsMock(...args),
    addConvocation: vi.fn(),
    addConvocationsBulk: vi.fn(),
    updateConvocationStatus: vi.fn(),
    deleteConvocation: vi.fn(),
  },
}));

vi.mock("../../../../../services/convocationStatusService", () => ({
  default: {
    getConvocationStatuses: vi.fn().mockResolvedValue([{ id: 2, name: "Accepted" }]),
  },
}));

const getAssistanceTypesMock = vi.fn();
vi.mock("../../../../../services/assistanceTypeService", () => ({
  default: {
    getAssistanceTypes: (...args: unknown[]) => getAssistanceTypesMock(...args),
  },
}));

const getTrainingAttendanceSummaryMock = vi.fn();
const getTeamConvocationsSummaryMock = vi.fn();
vi.mock("../../../../../services/attendanceSummaryService", () => ({
  default: {
    getTrainingAttendanceSummary: (...args: unknown[]) => getTrainingAttendanceSummaryMock(...args),
    getTeamConvocationsSummary: (...args: unknown[]) => getTeamConvocationsSummaryMock(...args),
  },
}));

const getIdealLineupMock = vi.fn();
vi.mock("../../../../../services/idealLineupService", () => ({
  getIdealLineup: (...args: unknown[]) => getIdealLineupMock(...args),
}));

vi.mock("../../../../../services/sportEventTypeService", () => ({
  default: {
    getSportEventTypes: vi.fn().mockResolvedValue([{ id: 1, name: "Partido" }, { id: 2, name: "Entrenamiento" }]),
  },
}));

const getSportEventsMock = vi.fn();
vi.mock("../../../../../services/sportEventService", () => ({
  default: { getSportEvents: (...args: unknown[]) => getSportEventsMock(...args) },
  getSportEvents: (...args: unknown[]) => getSportEventsMock(...args),
}));

const getPlayersByTeamMock = vi.fn();
vi.mock("../../../../../services/teamplayerService", () => ({
  default: {
    getPlayersByTeam: (...args: unknown[]) => getPlayersByTeamMock(...args),
  },
}));

const getActiveSeasonMock = vi.fn();
vi.mock("../../../../../services/seasonService", () => ({
  default: {
    getActiveSeason: (...args: unknown[]) => getActiveSeasonMock(...args),
  },
}));

import AttendanceSummaryContent from "../AttendanceSummaryContent";

function makeMatchEvent(id: string) {
  return {
    id,
    name: `Partido ${id}`,
    title: `Partido ${id}`,
    eventType: "Partido",
    eventTypeId: 1,
    startTime: "2026-01-01T10:00:00Z",
    rivalName: "Rival",
  };
}

describe("AttendanceSummaryContent - número de llamadas HTTP", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, "", "/coach/attendance/summary?teamId=team-1&seasonId=old-season");
    getConvocationsMock.mockResolvedValue([]);
    getAssistanceTypesMock.mockResolvedValue([]);
    getActiveSeasonMock.mockResolvedValue({
      id: "active-season",
      startDate: "2026-08-01T00:00:00Z",
      endDate: "2027-06-30T23:59:59Z",
    });
    getPlayersByTeamMock.mockResolvedValue([
      { id: "tp-1", playerId: "p-1", name: "Jugador", lastName: "Uno", alias: "J1" },
    ]);
    getTrainingAttendanceSummaryMock.mockResolvedValue({ totalTrainingEvents: 0, players: [] });
    getSportEventsMock.mockResolvedValue({
      items: [makeMatchEvent("event-1"), makeMatchEvent("event-2")],
      totalPages: 1,
    });
    getTeamConvocationsSummaryMock.mockResolvedValue([
      { eventId: "event-1", convocationId: "c1", teamPlayerId: "tp-1", playerId: "p-1", alias: "J1", statusId: 2, assistanceTypeId: null, excuseTypeId: null },
      { eventId: "event-2", convocationId: "c2", teamPlayerId: "tp-1", playerId: "p-1", alias: "J1", statusId: 2, assistanceTypeId: null, excuseTypeId: null },
    ]);
    getIdealLineupMock.mockResolvedValue({ id: "lineup-1", formationId: "f-1", slots: [] });
  });

  it("no llama a getConvocations por evento; usa getTeamConvocationsSummary una sola vez", async () => {
    render(<AttendanceSummaryContent teamId="team-1" />);

    await waitFor(() => expect(getTeamConvocationsSummaryMock).toHaveBeenCalledTimes(1));

    expect(getConvocationsMock).not.toHaveBeenCalled();
    expect(getTeamConvocationsSummaryMock).toHaveBeenCalledWith("team-1");
  });

  it("no llama a getIdealLineup — la titularidad del partido sale de getMatchMinutes (IsStarter real), no de la alineación ideal", async () => {
    render(<AttendanceSummaryContent teamId="team-1" />);

    await waitFor(() => expect(getTeamConvocationsSummaryMock).toHaveBeenCalledTimes(1));

    expect(getIdealLineupMock).not.toHaveBeenCalled();
  });

  it("usa la temporada activa en dashboard, entrenamientos y partidos", async () => {
    render(<AttendanceSummaryContent teamId="team-1" />);

    await waitFor(() => expect(getTeamConvocationsSummaryMock).toHaveBeenCalledTimes(1));

    expect(getSportEventsMock).toHaveBeenCalledWith(
      "team-1",
      1,
      200,
      "2026-08-01T00:00:00Z",
      "2027-06-30T23:59:59Z",
      true
    );
    expect(getPlayersByTeamMock).toHaveBeenCalledWith("team-1", "active-season");
    expect(getTrainingAttendanceSummaryMock).toHaveBeenCalledWith("team-1", "active-season");
  });

  it("excluye de entrenamientos los agregados de eventos ajenos a la temporada activa", async () => {
    getAssistanceTypesMock.mockResolvedValue([
      { id: 1, name: "Asistencia" },
      { id: 2, name: "No asistencia" },
    ]);
    getSportEventsMock.mockResolvedValue({
      items: [{
        id: "active-training",
        name: "Entrenamiento activo",
        title: "Entrenamiento activo",
        eventType: "Entrenamiento",
        eventTypeId: 2,
        startTime: "2026-09-01T10:00:00Z",
      }],
      totalPages: 1,
    });
    getTeamConvocationsSummaryMock.mockResolvedValue([
      { eventId: "active-training", convocationId: "c-active", teamPlayerId: "tp-1", playerId: "p-1", alias: "J1", statusId: 2, assistanceTypeId: 1, excuseTypeId: null },
      { eventId: "old-training", convocationId: "c-old", teamPlayerId: "tp-1", playerId: "p-1", alias: "J1", statusId: 2, assistanceTypeId: 2, excuseTypeId: null },
    ]);
    getTrainingAttendanceSummaryMock.mockResolvedValue({
      totalTrainingEvents: 2,
      players: [{
        teamPlayerId: "tp-1",
        playerId: "p-1",
        playerName: "Jugador Uno",
        totalTrainings: 2,
        attendedTrainings: 1,
        absentTrainings: 1,
        absences: [{
          eventId: "old-training",
          eventTitle: "Entrenamiento antiguo",
          date: "2025-09-01T10:00:00Z",
          reason: "No asistencia",
        }],
      }],
    });

    render(<AttendanceSummaryContent teamId="team-1" />);

    const trainingsTab = await screen.findByRole("tab", { name: /entrenamientos/i });
    trainingsTab.click();

    expect(await screen.findByText("1 posibles")).toBeInTheDocument();
    expect(screen.getByText("1 asistidos")).toBeInTheDocument();
    expect(screen.getByText("0 no asistidos")).toBeInTheDocument();
    expect(screen.queryByText("Entrenamiento antiguo")).not.toBeInTheDocument();
  });
});
