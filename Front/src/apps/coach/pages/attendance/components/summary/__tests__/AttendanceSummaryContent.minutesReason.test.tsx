import { render, screen, fireEvent } from "@testing-library/react";
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

const excuseTypeServiceGetExcuseTypesMock = vi.fn();
vi.mock("../../../../../services/excuseTypeService", () => ({
  default: {
    getExcuseTypes: (...args: unknown[]) => excuseTypeServiceGetExcuseTypesMock(...args),
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
    matchCategory: "League",
  };
}

describe("AttendanceSummaryContent — motivo de minutos (solo lectura)", () => {
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
    getSportEventsMock.mockResolvedValue({ items: [makeMatchEvent("event-1")], totalPages: 1 });
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
    ]);
    getSeasonPlayerMinutesMock.mockResolvedValue({ "tp-1": 90 });
    excuseTypeServiceGetExcuseTypesMock.mockResolvedValue([]);
  });

  it("propaga el minutesReason del backend hasta el icono de detalle del partido", async () => {
    getMatchMinutesMock.mockResolvedValue([
      { eventId: "event-1", teamPlayerId: "tp-1", minutesPlayed: 30, minutesReason: "Vuelta de vacaciones" },
    ]);

    render(<AttendanceSummaryContent teamId="team-1" />);

    const matchesTab = await screen.findByRole("tab", { name: /partidos/i });
    fireEvent.click(matchesTab);

    const cardToggle = await screen.findByRole("button", { name: /J1/i });
    fireEvent.click(cardToggle);

    expect(
      await screen.findByLabelText(/motivo de minutos: vuelta de vacaciones/i),
    ).toBeInTheDocument();
  });

  it("no muestra ningún icono de motivo cuando el backend no envía minutesReason", async () => {
    getMatchMinutesMock.mockResolvedValue([
      { eventId: "event-1", teamPlayerId: "tp-1", minutesPlayed: 30 },
    ]);

    render(<AttendanceSummaryContent teamId="team-1" />);

    const matchesTab = await screen.findByRole("tab", { name: /partidos/i });
    fireEvent.click(matchesTab);

    const cardToggle = await screen.findByRole("button", { name: /J1/i });
    fireEvent.click(cardToggle);

    expect(await screen.findByText("30'")).toBeInTheDocument();
    expect(screen.queryByLabelText(/motivo de minutos/i)).not.toBeInTheDocument();
  });
});
