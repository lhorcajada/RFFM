import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getEventPlayersMock = vi.fn();
const getConvocationsMock = vi.fn();

vi.mock("../../../services/convocationService", () => ({
  default: {
    getEventPlayers: (...args: unknown[]) => getEventPlayersMock(...args),
    getConvocations: (...args: unknown[]) => getConvocationsMock(...args),
    addConvocation: vi.fn(),
    addConvocationsBulk: vi.fn(),
    updateConvocationStatus: vi.fn(),
    deleteConvocation: vi.fn(),
  },
}));

vi.mock("../../../services/playerService", () => ({
  default: {
    fetchPlayerPhoto: vi.fn().mockResolvedValue(null),
    getPlayerById: vi.fn(),
    getPlayersByClub: vi.fn(),
    createPlayer: vi.fn(),
    uploadPlayerPhoto: vi.fn(),
  },
}));

vi.mock("../../../services/convocationStatusService", () => ({
  default: {
    getConvocationStatuses: vi.fn().mockResolvedValue([
      { id: 1, name: "Pending" },
      { id: 2, name: "Accepted" },
      { id: 3, name: "Deconvoke" },
    ]),
  },
}));

vi.mock("../../../services/excuseTypeService", () => ({
  default: {
    getExcuseTypes: vi.fn().mockResolvedValue([]),
  },
}));

const updateConvocationAssistanceMock = vi.fn();
vi.mock("../../../services/assistanceTypeService", () => ({
  default: {
    getAssistanceTypes: vi.fn().mockResolvedValue([
      { id: 1, name: "Asiste" },
      { id: 2, name: "No asiste con excusa" },
      { id: 3, name: "No asiste sin excusa" },
      { id: 4, name: "Llega tarde" },
    ]),
    updateConvocationAssistance: (...args: unknown[]) =>
      updateConvocationAssistanceMock(...args),
  },
}));

const hasRoleMock = vi.fn();
let rolesMock: string[] = ["Coach"];
vi.mock("../../../services/authService", () => ({
  coachAuthService: {
    getRoles: () => rolesMock,
    hasRole: (...args: unknown[]) => hasRoleMock(...args),
    hasPermission: vi.fn().mockReturnValue(true),
    getToken: vi.fn().mockReturnValue("fake-token"),
  },
}));

vi.mock("../../../services/coachApi", () => ({
  getMyProfile: vi.fn().mockResolvedValue(null),
}));

import AttendanceTabs from "../AttendanceTabs";

function conv(id: string, alias: string, assistanceTypeId: number | null) {
  return { id, player: { id: "p-" + id, playerId: "p-" + id, alias }, status: 2, assistanceTypeId, isInjured: false };
}

describe("AttendanceTabs - pestaña Asistencia", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    rolesMock = ["Coach"];
    hasRoleMock.mockImplementation((role: string) => role === "Coach");
    getEventPlayersMock.mockResolvedValue([]);
    getConvocationsMock.mockResolvedValue([
      conv("1", "Hugo", 1),
      conv("2", "Marc", 4),
      conv("3", "Alex", 3),
      conv("4", "Bruno", null),
    ]);
    render(
      <MemoryRouter>
        <AttendanceTabs eventId="event-1" eventStart={null} isMatch={false} />
      </MemoryRouter>
    );
    await userEvent.click(await screen.findByRole("tab", { name: /asistencia/i }));
  });

  it("muestra el resumen con los totales por estado", async () => {
    const summary = await screen.findByRole("region", { name: /resumen de la asistencia/i });
    expect(summary).toHaveTextContent("Aceptados");
    expect(summary).toHaveTextContent("Sin indicar");
    expect(summary).toHaveTextContent("No asisten");
  });

  it("agrupa a los jugadores en Asisten, No asisten y Sin indicar", async () => {
    expect((await screen.findAllByText("Asisten")).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Hugo")).toBeInTheDocument();
    expect(screen.getByText("Marc")).toBeInTheDocument();
    expect(screen.getByText("Alex")).toBeInTheDocument();
    expect(screen.getByText("Bruno")).toBeInTheDocument();
  });

  it("'Todos asisten' marca como asiste a quien no asiste aún", async () => {
    updateConvocationAssistanceMock.mockResolvedValue(undefined);
    await userEvent.click(await screen.findByRole("button", { name: /todos asisten/i }));
    await waitFor(() => expect(updateConvocationAssistanceMock).toHaveBeenCalledTimes(3));
    expect(updateConvocationAssistanceMock).toHaveBeenCalledWith("event-1", "2", 1, null);
  });
});
