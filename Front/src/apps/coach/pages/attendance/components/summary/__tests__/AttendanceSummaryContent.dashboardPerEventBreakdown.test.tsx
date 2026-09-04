import React from "react";
import { render, screen, waitFor, within, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Same mocking pattern as AttendanceSummaryContent.trainingsPhotoAndOrder.test.tsx —
// this file specifically covers the Dashboard tab's per-event breakdown, added by the
// dashboard-per-event-attendance-charts change.

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

const getAssistanceTypesMock = vi.fn().mockResolvedValue([
  { id: 10, name: "Asistencia" },
  { id: 20, name: "No asistencia" },
]);
const getTeamConvocationsSummaryMock = vi.fn();

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
  { id: "tp-1", playerId: "p-1", name: "Jugador", lastName: "Uno", alias: "J1", urlPhoto: null, dorsal: 9 },
  { id: "tp-2", playerId: "p-2", name: "Jugador", lastName: "Dos", alias: "J2", urlPhoto: null, dorsal: 2 },
]);
vi.mock("../../../../../services/teamplayerService", () => ({
  default: {
    getPlayersByTeam: (...args: unknown[]) => getPlayersByTeamMock(...args),
  },
}));

vi.mock("../../../../../services/playerService", () => ({
  default: {
    fetchPlayerPhoto: vi.fn().mockResolvedValue(null),
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

describe("AttendanceSummaryContent — desglose evento a evento del Dashboard (Entrenamientos)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAssistanceTypesMock.mockResolvedValue([
      { id: 10, name: "Asistencia" },
      { id: 20, name: "No asistencia" },
    ]);
    getRolesMock.mockReturnValue(["Coach"]);
    getMyProfileMock.mockResolvedValue(null);
  });

  it(
    "usa el mismo clasificador rico que el agregado (isAttendById/isAbsentById), " +
      "no el clasificador simple gateado por acceptedSet — para un evento con " +
      "convocatorias en un status distinto de 'Accepted' pero con assistanceTypeId marcando asistencia",
    async () => {
      // Regression fixture (same shape as AttendanceSummaryContent.trainingsPhotoAndOrder.test.tsx's
      // "el Resumen global coincide..." test): both convocations have statusId 1, which is NOT in
      // the mocked "Accepted" catalog (only id 2 is), so the simple acceptedSet-gated classifier
      // used by match/other would count 0 attend / 0 absent for this event. Training's own richer
      // classifier (assistanceTypeId-based) must count 1 attend / 1 absent instead.
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

      const trainingCard = (await screen.findByText("Entrenamientos")).closest("article") as HTMLElement;

      // Aggregate header: 1 attend / 1 absent -> 50%.
      await waitFor(() => expect(within(trainingCard).getByText("50%")).toBeInTheDocument());

      // Per-event breakdown (via "Ver como tabla") must show the same rich-classifier
      // numbers for the single finished training event, not 0/0 from the simple classifier.
      fireEvent.click(within(trainingCard).getByRole("button", { name: /ver como tabla/i }));
      const row = within(trainingCard).getByRole("row", { name: /entreno 1/i });
      const cells = within(row).getAllByRole("cell");
      // columns: título, fecha, asisten, no asisten, %
      expect(cells[2]).toHaveTextContent("1");
      expect(cells[3]).toHaveTextContent("1");
    }
  );

  it("el % agregado de la cabecera coincide con la suma de los puntos evento a evento (por construcción)", async () => {
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

    const trainingCard = (await screen.findByText("Entrenamientos")).closest("article") as HTMLElement;
    const globalCard = screen.getByText("Resumen global").closest("article") as HTMLElement;

    await waitFor(() =>
      expect(within(globalCard).getByText("Asisten").parentElement).toHaveTextContent("1")
    );
    expect(within(globalCard).getByText("No asisten").parentElement).toHaveTextContent("1");
    expect(within(trainingCard).getByText("50%")).toBeInTheDocument();
  });
});
