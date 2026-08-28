import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getEventPlayersMock = vi.fn();
const getConvocationsMock = vi.fn();
const updateConvocationStatusMock = vi.fn();

vi.mock("../../../services/convocationService", () => ({
  default: {
    getEventPlayers: (...args: unknown[]) => getEventPlayersMock(...args),
    getConvocations: (...args: unknown[]) => getConvocationsMock(...args),
    addConvocation: vi.fn(),
    addConvocationsBulk: vi.fn(),
    updateConvocationStatus: (...args: unknown[]) => updateConvocationStatusMock(...args),
    deleteConvocation: vi.fn(),
  },
  getEventPlayers: (...args: unknown[]) => getEventPlayersMock(...args),
  getConvocations: (...args: unknown[]) => getConvocationsMock(...args),
  addConvocation: vi.fn(),
  addConvocationsBulk: vi.fn(),
  updateConvocationStatus: (...args: unknown[]) => updateConvocationStatusMock(...args),
  deleteConvocation: vi.fn(),
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

vi.mock("../../../services/assistanceTypeService", () => ({
  default: {
    getAssistanceTypes: vi.fn().mockResolvedValue([]),
    updateConvocationAssistance: vi.fn(),
  },
}));

const getRolesMock = vi.fn();
const hasRoleMock = vi.fn();

vi.mock("../../../services/authService", () => ({
  coachAuthService: {
    getRoles: (...args: unknown[]) => getRolesMock(...args),
    hasRole: (...args: unknown[]) => hasRoleMock(...args),
    hasPermission: vi.fn().mockReturnValue(true),
    getToken: vi.fn().mockReturnValue("fake-token"),
  },
}));

const getMyProfileMock = vi.fn();

vi.mock("../../../services/coachApi", () => ({
  getMyProfile: (...args: unknown[]) => getMyProfileMock(...args),
}));

import AttendanceTabs from "../AttendanceTabs";

const DECLINED_CONV = {
  id: "conv-declined-1",
  player: {
    id: "declined-1",
    playerId: "declined-1",
    alias: "Desconvocado Uno",
    urlPhoto: null,
    position: "PT",
  },
  status: 3,
  isInjured: false,
  excuseTypeId: null,
};

function setup({ roles, playerId }: { roles: string[]; playerId: string | null }) {
  getRolesMock.mockReturnValue(roles);
  hasRoleMock.mockImplementation((role: string) => roles.includes(role) || roles.includes("Administrator"));
  getMyProfileMock.mockResolvedValue(playerId ? { roleName: roles[0], playerId } : null);
  getEventPlayersMock.mockResolvedValue([]);
  getConvocationsMock.mockResolvedValue([DECLINED_CONV]);
}

async function renderTabs(isTraining: boolean) {
  render(
    <MemoryRouter>
      <AttendanceTabs eventId="event-1" eventStart={null} isMatch={!isTraining} isTraining={isTraining} />
    </MemoryRouter>
  );
  const header = await screen.findByRole("button", { name: /^Desconvocados/i });
  await userEvent.click(header);
  await screen.findByText("Desconvocado Uno");
}

describe("AttendanceTabs - reactivación de un jugador desconvocado (Player/FamilyMember)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra los botones de reactivación a un Player en un evento de tipo Entrenamiento para su propio jugador", async () => {
    setup({ roles: ["Player"], playerId: "declined-1" });
    await renderTabs(true);

    expect(screen.getByRole("button", { name: "Pendiente de aceptar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aceptar" })).toBeInTheDocument();
  });

  it("no muestra los botones de reactivación a un FamilyMember en un evento que no es de tipo Entrenamiento (p.ej. Partido)", async () => {
    setup({ roles: ["FamilyMember"], playerId: "declined-1" });
    await renderTabs(false);

    expect(screen.queryByRole("button", { name: "Pendiente de aceptar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Aceptar" })).not.toBeInTheDocument();
  });

  it("muestra los botones de reactivación a un Coach en cualquier tipo de evento (comportamiento sin restricciones)", async () => {
    setup({ roles: ["Coach"], playerId: null });
    await renderTabs(false);

    expect(screen.getByRole("button", { name: "Pendiente de aceptar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aceptar" })).toBeInTheDocument();
  });

  it("nunca muestra el botón 'Lista de espera' a un Player/FamilyMember, ni siquiera en un evento de Entrenamiento", async () => {
    setup({ roles: ["Player"], playerId: "declined-1" });
    await renderTabs(true);

    expect(screen.queryByRole("button", { name: "↩ Lista de espera" })).not.toBeInTheDocument();
  });

  it("muestra el botón 'Lista de espera' a un Coach", async () => {
    setup({ roles: ["Coach"], playerId: null });
    await renderTabs(true);

    expect(screen.getByRole("button", { name: "↩ Lista de espera" })).toBeInTheDocument();
  });

  it("muestra el mensaje de error del backend (ProblemDetails.detail) si la reactivación es rechazada con 403 (defensa en profundidad)", async () => {
    setup({ roles: ["Coach"], playerId: null });
    updateConvocationStatusMock.mockRejectedValueOnce({
      response: {
        status: 403,
        data: { detail: "Solo se puede reactivar una convocatoria desconvocada en eventos de tipo entrenamiento." },
      },
    });
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    await renderTabs(false);

    await userEvent.click(screen.getByRole("button", { name: "Aceptar" }));

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(
        "Solo se puede reactivar una convocatoria desconvocada en eventos de tipo entrenamiento."
      )
    );
    alertSpy.mockRestore();
  });
});
