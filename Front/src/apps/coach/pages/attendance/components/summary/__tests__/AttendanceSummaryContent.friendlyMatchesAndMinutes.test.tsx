import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../../services/convocationService", () => ({
  default: {
    getEventPlayers: vi.fn(),
    getConvocations: vi.fn().mockResolvedValue([]),
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

vi.mock("../../../../../services/idealLineupService", () => ({
  getIdealLineup: vi.fn().mockResolvedValue({ id: "lineup-1", formationId: "f-1", slots: [] }),
}));

vi.mock("../../../../../services/sportEventTypeService", () => ({
  default: {
    getSportEventTypes: vi.fn().mockResolvedValue([{ id: 1, name: "Partido" }]),
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

const getMatchMinutesMock = vi.fn();
const getSeasonPlayerMinutesMock = vi.fn();
vi.mock("../../../../../services/liveMatchService", () => ({
  default: {
    getMatchMinutes: (...args: unknown[]) => getMatchMinutesMock(...args),
    getSeasonPlayerMinutes: (...args: unknown[]) => getSeasonPlayerMinutesMock(...args),
  },
  getMatchMinutes: (...args: unknown[]) => getMatchMinutesMock(...args),
  getSeasonPlayerMinutes: (...args: unknown[]) => getSeasonPlayerMinutesMock(...args),
}));

import AttendanceSummaryContent from "../AttendanceSummaryContent";

function makeMatchEvent(id: string, opts: { friendly?: boolean } = {}) {
  return {
    id,
    name: `Partido ${id}`,
    title: `Partido ${id}`,
    eventType: "Partido",
    eventTypeId: 1,
    startTime: "2026-01-01T10:00:00Z",
    rivalName: "Rival",
    matchCategory: opts.friendly ? "Friendly" : "League",
  };
}

describe("AttendanceSummaryContent — partidos amistosos y minutos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getActiveSeasonMock.mockResolvedValue({
      id: "active-season",
      startDate: "2026-08-01T00:00:00Z",
      endDate: "2027-06-30T23:59:59Z",
    });
    getPlayersByTeamMock.mockResolvedValue([
      { id: "tp-1", playerId: "p-1", name: "Jugador", lastName: "Uno", alias: "J1" },
    ]);
    getSportEventsMock.mockResolvedValue({
      items: [makeMatchEvent("event-1"), makeMatchEvent("event-2", { friendly: true })],
      totalPages: 1,
    });
    getTeamConvocationsSummaryMock.mockResolvedValue([
      {
        eventId: "event-1",
        convocationId: "c1",
        teamPlayerId: "tp-1",
        playerId: "p-1",
        alias: "J1",
        statusId: 2,
        assistanceTypeId: null,
        excuseTypeId: null,
      },
      {
        eventId: "event-2",
        convocationId: "c2",
        teamPlayerId: "tp-1",
        playerId: "p-1",
        alias: "J1",
        statusId: 2,
        assistanceTypeId: null,
        excuseTypeId: null,
      },
    ]);
    getMatchMinutesMock.mockResolvedValue([
      { eventId: "event-1", teamPlayerId: "tp-1", minutesPlayed: 90 },
      { eventId: "event-2", teamPlayerId: "tp-1", minutesPlayed: 45 },
    ]);
    getSeasonPlayerMinutesMock.mockResolvedValue({ "tp-1": 315 });
  });

  it("incluye la jornada amistosa en la pestaña de partidos junto a la oficial", async () => {
    render(<AttendanceSummaryContent teamId="team-1" />);

    const matchesTab = await screen.findByRole("tab", { name: /partidos/i });
    matchesTab.click();

    expect(await screen.findByText("2 jornadas")).toBeInTheDocument();
    expect(screen.getByText("Amistoso")).toBeInTheDocument();
  });

  it("muestra los minutos jugados por partido y el total de temporada", async () => {
    render(<AttendanceSummaryContent teamId="team-1" />);

    const matchesTab = await screen.findByRole("tab", { name: /partidos/i });
    matchesTab.click();

    await waitFor(() => expect(screen.getByText("90'")).toBeInTheDocument());
    expect(screen.getByText("45'")).toBeInTheDocument();
    expect(screen.getByText(/315/)).toBeInTheDocument();
  });
});
