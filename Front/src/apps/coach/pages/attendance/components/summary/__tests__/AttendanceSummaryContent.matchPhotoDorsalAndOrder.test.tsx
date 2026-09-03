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

const fetchPlayerPhotoMock = vi.fn();
vi.mock("../../../../../services/playerService", () => ({
  default: {
    fetchPlayerPhoto: (...args: unknown[]) => fetchPlayerPhotoMock(...args),
  },
}));

const getMyProfileMock = vi.fn();
vi.mock("../../../../../services/coachApi", () => ({
  getMyProfile: (...args: unknown[]) => getMyProfileMock(...args),
}));

const getRolesMock = vi.fn();
vi.mock("../../../../../services/authService", () => ({
  coachAuthService: {
    getRoles: (...args: unknown[]) => getRolesMock(...args),
  },
}));

const getTeamConvocationsSummaryMock = vi.fn();

vi.mock("../../../../../services/excuseTypeService", () => ({
  default: {
    getExcuseTypes: vi.fn().mockResolvedValue([]),
  },
}));

import AttendanceSummaryContent from "../AttendanceSummaryContent";

function makeMatchEvent(id: string, date = "2026-01-01T10:00:00Z") {
  return {
    id,
    name: `Partido ${id}`,
    title: `Partido ${id}`,
    eventType: "Partido",
    eventTypeId: 1,
    startTime: date,
    rivalName: "Rival",
    matchCategory: "League",
  };
}

async function openMatchesTab() {
  const tab = await screen.findByRole("tab", { name: /partidos/i });
  tab.click();
}

describe("AttendanceSummaryContent — foto, dorsal y orden del jugador asociado (partidos)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchPlayerPhotoMock.mockResolvedValue("blob:mock-photo-1");
    getActiveSeasonMock.mockResolvedValue({
      id: "active-season",
      startDate: "2026-08-01T00:00:00Z",
      endDate: "2027-06-30T23:59:59Z",
    });
    getSportEventsMock.mockResolvedValue({ items: [makeMatchEvent("event-1")], totalPages: 1 });
    getMatchMinutesMock.mockResolvedValue([]);
    getSeasonPlayerMinutesMock.mockResolvedValue({});
  });

  it("asigna la foto y el dorsal de cada jugador a partir de teamplayerService", async () => {
    getRolesMock.mockReturnValue(["Coach"]);
    getMyProfileMock.mockResolvedValue(null);
    getPlayersByTeamMock.mockResolvedValue([
      { id: "tp-1", playerId: "p-1", name: "Jugador", lastName: "Uno", alias: "J1", urlPhoto: "photo-1.jpg", dorsal: 9 },
    ]);
    getTeamConvocationsSummaryMock.mockResolvedValue([
      { eventId: "event-1", convocationId: "c1", teamPlayerId: "tp-1", playerId: "p-1", alias: "J1", statusId: 2, assistanceTypeId: null, excuseTypeId: null },
    ]);

    render(<AttendanceSummaryContent teamId="team-1" />);
    await openMatchesTab();

    await waitFor(() => expect(screen.getByAltText("J1")).toHaveAttribute("src", "blob:mock-photo-1"));
    expect(screen.getByTitle("Dorsal 9")).toBeInTheDocument();
  });

  it("ordena las tarjetas por dorsal ascendente", async () => {
    getRolesMock.mockReturnValue(["Coach"]);
    getMyProfileMock.mockResolvedValue(null);
    getPlayersByTeamMock.mockResolvedValue([
      { id: "tp-1", playerId: "p-1", name: "Jugador", lastName: "Uno", alias: "Dorsal Diez", dorsal: 10 },
      { id: "tp-2", playerId: "p-2", name: "Jugador", lastName: "Dos", alias: "Dorsal Tres", dorsal: 3 },
    ]);
    getTeamConvocationsSummaryMock.mockResolvedValue([]);

    render(<AttendanceSummaryContent teamId="team-1" />);
    await openMatchesTab();

    const names = await waitFor(() => {
      const found = screen.getAllByText(/Dorsal (Diez|Tres)/);
      expect(found.length).toBe(2);
      return found;
    });
    expect(names[0]).toHaveTextContent("Dorsal Tres");
    expect(names[1]).toHaveTextContent("Dorsal Diez");
  });

  it("coloca a los jugadores sin dorsal al final, ordenados alfabéticamente", async () => {
    getRolesMock.mockReturnValue(["Coach"]);
    getMyProfileMock.mockResolvedValue(null);
    getPlayersByTeamMock.mockResolvedValue([
      { id: "tp-1", playerId: "p-1", name: "Jugador", lastName: "Uno", alias: "Sin Dorsal", dorsal: null },
      { id: "tp-2", playerId: "p-2", name: "Jugador", lastName: "Dos", alias: "Con Dorsal", dorsal: 5 },
    ]);
    getTeamConvocationsSummaryMock.mockResolvedValue([]);

    render(<AttendanceSummaryContent teamId="team-1" />);
    await openMatchesTab();

    const names = await waitFor(() => {
      const found = screen.getAllByText(/(Sin|Con) Dorsal/);
      expect(found.length).toBe(2);
      return found;
    });
    expect(names[0]).toHaveTextContent("Con Dorsal");
    expect(names[1]).toHaveTextContent("Sin Dorsal");
  });

  it("pone primero al jugador asociado cuando el usuario es Player/Family, aunque su dorsal sea mayor", async () => {
    getRolesMock.mockReturnValue(["FamilyPlayer"]);
    getMyProfileMock.mockResolvedValue({ roleName: "FamilyPlayer", playerId: "p-2" });
    getPlayersByTeamMock.mockResolvedValue([
      { id: "tp-1", playerId: "p-1", name: "Jugador", lastName: "Uno", alias: "Dorsal Uno", dorsal: 1 },
      { id: "tp-2", playerId: "p-2", name: "Jugador", lastName: "Dos", alias: "Dorsal Nueve", dorsal: 9 },
    ]);
    getTeamConvocationsSummaryMock.mockResolvedValue([]);

    render(<AttendanceSummaryContent teamId="team-1" />);
    await openMatchesTab();

    const names = await waitFor(() => {
      const found = screen.getAllByText(/Dorsal (Uno|Nueve)/);
      expect(found.length).toBe(2);
      return found;
    });
    expect(names[0]).toHaveTextContent("Dorsal Nueve");
  });
});
