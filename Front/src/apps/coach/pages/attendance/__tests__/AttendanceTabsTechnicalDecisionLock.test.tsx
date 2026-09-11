import React from "react";
import { render, screen } from "@testing-library/react";
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
    getExcuseTypes: vi.fn().mockResolvedValue([
      { id: 1, name: "Lesión", justified: true },
      { id: 7, name: "Decisión técnica", justified: false },
    ]),
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

function deconvokedConv(excuseTypeId: number | null) {
  return {
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
    excuseTypeId,
  };
}

function setup({ roles, conv }: { roles: string[]; conv: ReturnType<typeof deconvokedConv> }) {
  getRolesMock.mockReturnValue(roles);
  hasRoleMock.mockImplementation((role: string) => roles.includes(role));
  getMyProfileMock.mockResolvedValue({ roleName: roles[0], playerId: "declined-1" });
  getEventPlayersMock.mockResolvedValue([]);
  getConvocationsMock.mockResolvedValue([conv]);
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

describe("AttendanceTabs - bloqueo de desconvocatoria por 'Decisión técnica' (Player/FamilyMember)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("no muestra 'Editar motivo' a un Player cuando la desconvocatoria es por Decisión técnica", async () => {
    setup({ roles: ["Player"], conv: deconvokedConv(7) });
    await renderTabs(true);

    expect(screen.queryByRole("button", { name: "✎ Editar motivo" })).not.toBeInTheDocument();
  });

  it("no muestra los botones de reactivación a un FamilyMember en un entrenamiento cuando la desconvocatoria es por Decisión técnica", async () => {
    setup({ roles: ["FamilyMember"], conv: deconvokedConv(7) });
    await renderTabs(true);

    expect(screen.queryByRole("button", { name: "Pendiente de aceptar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Aceptar" })).not.toBeInTheDocument();
  });

  it("sí muestra 'Editar motivo' y reactivación a un Player en un entrenamiento cuando la desconvocatoria NO es por Decisión técnica", async () => {
    setup({ roles: ["Player"], conv: deconvokedConv(1) });
    await renderTabs(true);

    expect(screen.getByRole("button", { name: "✎ Editar motivo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pendiente de aceptar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aceptar" })).toBeInTheDocument();
  });

  it("un Coach sí puede editar el motivo aunque sea Decisión técnica", async () => {
    setup({ roles: ["Coach"], conv: deconvokedConv(7) });
    await renderTabs(true);

    expect(screen.getByRole("button", { name: "✎ Editar motivo" })).toBeInTheDocument();
  });
});
