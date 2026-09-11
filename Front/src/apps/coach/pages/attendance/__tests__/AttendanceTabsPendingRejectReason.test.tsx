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
      { id: 3, name: "Enfermedad", justified: true },
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

const PENDING_CONV = {
  id: "conv-pending-1",
  player: {
    id: "player-1",
    playerId: "player-1",
    alias: "Jugador Pendiente",
    urlPhoto: null,
    position: "PT",
  },
  status: 1,
  isInjured: false,
  excuseTypeId: null,
};

function setup(roles: string[]) {
  getRolesMock.mockReturnValue(roles);
  hasRoleMock.mockImplementation((role: string) => roles.includes(role));
  getMyProfileMock.mockResolvedValue({ roleName: roles[0], playerId: "player-1" });
  getEventPlayersMock.mockResolvedValue([]);
  getConvocationsMock.mockResolvedValue([PENDING_CONV]);
}

async function renderTabs() {
  render(
    <MemoryRouter>
      <AttendanceTabs eventId="event-1" eventStart={null} isMatch={false} />
    </MemoryRouter>
  );
  await screen.findByRole("button", { name: /^Pendientes de aceptar/i });
}

describe("AttendanceTabs - motivo de rechazo desde 'Sin indicar' (Player/FamilyMember)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("no ofrece 'Decisión técnica' como motivo cuando un Player rechaza su propia convocatoria pendiente", async () => {
    setup(["Player"]);
    await renderTabs();

    await userEvent.click(screen.getByRole("button", { name: "Rechazar" }));

    await screen.findByText("Motivo de desconvocatoria");
    expect(screen.queryByText("Decisión técnica")).not.toBeInTheDocument();
    expect(screen.getByText("Lesión")).toBeInTheDocument();
  });

  it("no ofrece 'Decisión técnica' como motivo cuando un FamilyMember rechaza la convocatoria pendiente de su jugador", async () => {
    setup(["FamilyMember"]);
    await renderTabs();

    await userEvent.click(screen.getByRole("button", { name: "Rechazar" }));

    await screen.findByText("Motivo de desconvocatoria");
    expect(screen.queryByText("Decisión técnica")).not.toBeInTheDocument();
  });

  it("sí ofrece 'Decisión técnica' como motivo cuando un Coach desconvoca a un jugador pendiente", async () => {
    setup(["Coach"]);
    await renderTabs();

    await userEvent.click(screen.getByRole("button", { name: /^Pendientes de aceptar/i }));
    await screen.findByText("Jugador Pendiente");
    await userEvent.click(screen.getByRole("button", { name: "Rechazar" }));

    await screen.findByText("Motivo de desconvocatoria");
    expect(screen.getByText("Decisión técnica")).toBeInTheDocument();
  });
});
