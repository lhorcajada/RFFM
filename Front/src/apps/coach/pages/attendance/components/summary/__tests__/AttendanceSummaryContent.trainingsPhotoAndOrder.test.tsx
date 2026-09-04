import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
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

const getAssistanceTypesMock = vi.fn().mockResolvedValue([]);
const getTeamConvocationsSummaryMock = vi.fn().mockResolvedValue([]);

vi.mock("../../../../../services/assistanceTypeService", () => ({
  default: {
    getAssistanceTypes: (...args: unknown[]) => getAssistanceTypesMock(...args),
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
          absences: [],
        },
        {
          teamPlayerId: "tp-2",
          playerId: "p-2",
          playerName: "Jugador Dos",
          totalTrainings: 1,
          attendedTrainings: 0,
          absentTrainings: 1,
          absences: [],
        },
      ],
    }),
    getTeamConvocationsSummary: (...args: unknown[]) => getTeamConvocationsSummaryMock(...args),
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

const getPlayersByTeamMock = vi.fn().mockResolvedValue([
  { id: "tp-1", playerId: "p-1", name: "Jugador", lastName: "Uno", alias: "J1", urlPhoto: "photo-1.jpg", dorsal: 9 },
  { id: "tp-2", playerId: "p-2", name: "Jugador", lastName: "Dos", alias: "J2", urlPhoto: null, dorsal: 2 },
]);
vi.mock("../../../../../services/teamplayerService", () => ({
  default: {
    getPlayersByTeam: (...args: unknown[]) => getPlayersByTeamMock(...args),
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

vi.mock("../../../../../services/excuseTypeService", () => ({
  default: {
    getExcuseTypes: vi.fn().mockResolvedValue([]),
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

  it("ordena las tarjetas por dorsal ascendente", async () => {
    getRolesMock.mockReturnValue(["Coach"]);
    getMyProfileMock.mockResolvedValue(null);
    renderTrainingsTab();

    await waitFor(() => expect(screen.getByRole("tab", { name: /entrenamientos/i })).toBeInTheDocument());
    screen.getByRole("tab", { name: /entrenamientos/i }).click();

    // tp-2 has dorsal 2, tp-1 has dorsal 9 — Jugador Dos must come first.
    const cards = await waitFor(() => {
      const names = screen.getAllByText(/Jugador (Uno|Dos)/);
      expect(names.length).toBe(2);
      return names;
    });
    expect(cards[0]).toHaveTextContent("Jugador Dos");
    expect(cards[1]).toHaveTextContent("Jugador Uno");
  });

  it("el Resumen global coincide con la tarjeta de Entrenamientos cuando es el único tipo de evento", async () => {
    // Regression: nextSummary.total was accumulated in a first pass that only
    // evaluates convocations whose status literally matches "Accepted"
    // (acceptedSet), before nextSummary.training gets recalculated (and
    // overwritten) from a second pass over ALL convocations for the event,
    // regardless of status — the recalculated, more-correct training numbers
    // never fed back into total. Here both players have a convocation with a
    // non-"Accepted" status (id 1, not in the mocked status catalog below) so
    // the first pass excludes them entirely (0/0), while the second pass still
    // classifies them as attend/absent via assistanceTypeId — exposing exactly
    // the mismatch the user reported (dashboard total didn't match the tile).
    getRolesMock.mockReturnValue(["Coach"]);
    getMyProfileMock.mockResolvedValue(null);
    getAssistanceTypesMock.mockResolvedValue([
      { id: 10, name: "Asistencia" },
      { id: 20, name: "No asistencia" },
    ]);
    getTeamConvocationsSummaryMock.mockResolvedValue([
      {
        eventId: "event-1",
        convocationId: "c1",
        teamPlayerId: "tp-1",
        playerId: "p-1",
        alias: "J1",
        statusId: 1,
        assistanceTypeId: 10,
        excuseTypeId: null,
      },
      {
        eventId: "event-1",
        convocationId: "c2",
        teamPlayerId: "tp-2",
        playerId: "p-2",
        alias: "J2",
        statusId: 1,
        assistanceTypeId: 20,
        excuseTypeId: null,
      },
    ]);
    render(<AttendanceSummaryContent teamId="team-1" />);

    const globalCard = (await screen.findByText("Resumen global")).closest("article") as HTMLElement;
    const trainingCard = screen.getByText("Entrenamientos").closest("article") as HTMLElement;

    await waitFor(() =>
      expect(within(trainingCard).getByText("Asisten").parentElement).toHaveTextContent("1")
    );
    expect(within(trainingCard).getByText("No asisten").parentElement).toHaveTextContent("1");
    expect(within(globalCard).getByText("Asisten").parentElement).toHaveTextContent("1");
    expect(within(globalCard).getByText("No asisten").parentElement).toHaveTextContent("1");
  });
});
