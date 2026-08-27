import React from "react";
import { render, waitFor } from "@testing-library/react";
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

vi.mock("../../../../../services/assistanceTypeService", () => ({
  default: {
    getAssistanceTypes: vi.fn().mockResolvedValue([]),
  },
}));

const getTeamConvocationsSummaryMock = vi.fn();
vi.mock("../../../../../services/attendanceSummaryService", () => ({
  default: {
    getTrainingAttendanceSummary: vi.fn().mockResolvedValue({ totalTrainingEvents: 0, players: [] }),
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

vi.mock("../../../../../services/teamplayerService", () => ({
  default: {
    getPlayersByTeam: vi.fn().mockResolvedValue([
      { id: "tp-1", playerId: "p-1", name: "Jugador", lastName: "Uno", alias: "J1" },
    ]),
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
    getConvocationsMock.mockResolvedValue([]);
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

  it("llama a getIdealLineup una sola vez aunque haya varios partidos oficiales", async () => {
    render(<AttendanceSummaryContent teamId="team-1" />);

    await waitFor(() => expect(getIdealLineupMock).toHaveBeenCalledTimes(1));

    expect(getIdealLineupMock).toHaveBeenCalledTimes(1);
  });
});
