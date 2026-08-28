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
    getTrainingAttendanceSummary: vi.fn().mockResolvedValue({
      totalTrainingEvents: 1,
      players: [
        {
          teamPlayerId: "tp-1",
          playerId: "p-1",
          playerName: "Jugador Uno",
          totalTrainings: 1,
          attendedTrainings: 1,
          absentTrainings: 0,
          pendingTrainings: 0,
          absences: [],
        },
        {
          teamPlayerId: "tp-2",
          playerId: "p-2",
          playerName: "Jugador Dos",
          totalTrainings: 1,
          attendedTrainings: 0,
          absentTrainings: 1,
          pendingTrainings: 0,
          absences: [],
        },
      ],
    }),
    getTeamConvocationsSummary: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../../../../../services/idealLineupService", () => ({
  getIdealLineup: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../../../../services/sportEventTypeService", () => ({
  default: {
    getSportEventTypes: vi.fn().mockResolvedValue([{ id: 1, name: "Entrenamiento" }]),
  },
}));

vi.mock("../../../../../services/sportEventService", () => ({
  default: {
    getSportEvents: vi.fn().mockResolvedValue({
      items: [
        {
          id: "event-1",
          name: "Entreno 1",
          title: "Entreno 1",
          eventType: "Entrenamiento",
          eventTypeId: 1,
          startTime: "2026-01-01T10:00:00Z",
        },
      ],
      totalPages: 1,
    }),
  },
  getSportEvents: vi.fn(),
}));

vi.mock("../../../../../services/teamplayerService", () => ({
  default: {
    getPlayersByTeam: vi.fn().mockResolvedValue([
      { id: "tp-1", playerId: "p-1", name: "Jugador", lastName: "Uno", alias: "J1", urlPhoto: "photo-1.jpg" },
      { id: "tp-2", playerId: "p-2", name: "Jugador", lastName: "Dos", alias: "J2", urlPhoto: null },
    ]),
  },
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

import AttendanceSummaryContent from "../AttendanceSummaryContent";

function renderTrainingsTab() {
  render(<AttendanceSummaryContent teamId="team-1" />);
}

describe("AttendanceSummaryContent — foto y orden del jugador asociado (entrenamientos)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchPlayerPhotoMock.mockResolvedValue("blob:mock-photo-1");
  });

  it("asigna la foto de cada jugador a partir de teamplayerService", async () => {
    getRolesMock.mockReturnValue(["Coach"]);
    getMyProfileMock.mockResolvedValue(null);
    renderTrainingsTab();

    await waitFor(() => expect(screen.getByRole("tab", { name: /entrenamientos/i })).toBeInTheDocument());
    screen.getByRole("tab", { name: /entrenamientos/i }).click();

    await waitFor(() => expect(fetchPlayerPhotoMock).toHaveBeenCalledWith("photo-1.jpg"));
    await waitFor(() => expect(screen.getByAltText("Jugador Uno")).toHaveAttribute("src", "blob:mock-photo-1"));
  });

  it("pone primero al jugador asociado cuando el usuario es Player/Family", async () => {
    getRolesMock.mockReturnValue(["FamilyPlayer"]);
    getMyProfileMock.mockResolvedValue({ roleName: "FamilyPlayer", playerId: "p-2" });
    renderTrainingsTab();

    await waitFor(() => expect(screen.getByRole("tab", { name: /entrenamientos/i })).toBeInTheDocument());
    screen.getByRole("tab", { name: /entrenamientos/i }).click();

    const cards = await waitFor(() => {
      const names = screen.getAllByText(/Jugador (Uno|Dos)/);
      expect(names.length).toBe(2);
      return names;
    });
    expect(cards[0]).toHaveTextContent("Jugador Dos");
  });
});
