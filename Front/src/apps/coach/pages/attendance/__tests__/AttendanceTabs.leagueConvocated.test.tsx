import { render, screen } from "@testing-library/react";
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
  getEventPlayers: (...args: unknown[]) => getEventPlayersMock(...args),
  getConvocations: (...args: unknown[]) => getConvocationsMock(...args),
}));

vi.mock("../../../services/playerService", () => ({
  default: { fetchPlayerPhoto: vi.fn().mockResolvedValue(null) },
}));

vi.mock("../../../services/convocationStatusService", () => ({
  default: {
    getConvocationStatuses: vi.fn().mockResolvedValue([
      { id: 1, name: "Pending" },
      { id: 2, name: "Accepted" },
      { id: 5, name: "Deconvoke" },
    ]),
  },
}));

vi.mock("../../../services/excuseTypeService", () => ({
  default: { getExcuseTypes: vi.fn().mockResolvedValue([]) },
}));

vi.mock("../../../services/assistanceTypeService", () => ({
  default: { getAssistanceTypes: vi.fn().mockResolvedValue([]), updateConvocationAssistance: vi.fn() },
}));

vi.mock("../../../services/availabilityService", () => ({
  default: { getAvailabilityRequests: vi.fn().mockResolvedValue([]) },
}));

vi.mock("../../../services/authService", () => ({
  coachAuthService: {
    getRoles: vi.fn().mockReturnValue(["Coach"]),
    hasRole: vi.fn((role: string) => role === "Coach"),
    hasPermission: vi.fn().mockReturnValue(true),
    getToken: vi.fn().mockReturnValue("fake-token"),
  },
}));

vi.mock("../../../services/coachApi", () => ({
  getMyProfile: vi.fn().mockResolvedValue(null),
}));

import AttendanceTabs from "../AttendanceTabs";

const PENDING_CONV = {
  id: "conv-pending-1",
  player: { id: "pending-1", playerId: "pending-1", alias: "Pendiente Uno", urlPhoto: null, position: "Defensa" },
  status: 1,
  isInjured: false,
};

const ACCEPTED_CONV = {
  id: "conv-accepted-1",
  player: { id: "accepted-1", playerId: "accepted-1", alias: "Aceptado Uno", urlPhoto: null, position: "Delantero" },
  status: 2,
  isInjured: false,
};

async function renderTabs(isLeagueMatch: boolean) {
  render(
    <MemoryRouter>
      <AttendanceTabs eventId="event-1" eventStart={null} isMatch isLeagueMatch={isLeagueMatch} />
    </MemoryRouter>,
  );
  await screen.findByRole("button", { name: /^Lista de espera/i });
}

describe("AttendanceTabs — convocados en partidos de liga", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getEventPlayersMock.mockResolvedValue([]);
    getConvocationsMock.mockResolvedValue([PENDING_CONV, ACCEPTED_CONV]);
  });

  it("no separa a los convocados en pendientes de aceptar y aceptados", async () => {
    await renderTabs(true);

    await screen.findByText("Aceptado Uno");
    expect(screen.queryByRole("button", { name: /^Pendientes de aceptar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Aceptados/i })).not.toBeInTheDocument();
  });

  it("muestra a todos los convocados en un único listado, aunque su convocatoria siga pendiente", async () => {
    await renderTabs(true);

    expect(await screen.findByText("Pendiente Uno")).toBeInTheDocument();
    expect(screen.getByText("Aceptado Uno")).toBeInTheDocument();
  });

  it("no ofrece aceptar la convocatoria, solo desconvocar", async () => {
    await renderTabs(true);

    await screen.findByText("Pendiente Uno");
    expect(screen.queryByRole("button", { name: "Aceptar" })).not.toBeInTheDocument();
    expect(screen.queryByText("Pendiente de aceptar")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Acciones de/ })).toHaveLength(2);
    await userEvent.click(screen.getByRole("button", { name: "Acciones de Pendiente Uno" }));
    expect(screen.getByRole("menuitem", { name: "Desconvocar" })).toBeInTheDocument();
  });

  it("una lista vacía sigue plegada aunque se pulse", async () => {
    await renderTabs(true);
    const toggle = screen.getByRole("button", { name: /^Pendientes de respuesta/i });

    await userEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("No hay jugadores pendientes de responder.")).not.toBeInTheDocument();
  });

  it("fuera de los partidos de liga mantiene los grupos de pendientes de aceptar y aceptados", async () => {
    await renderTabs(false);

    expect(await screen.findByRole("button", { name: /^Pendientes de aceptar/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Aceptados/i })).toBeInTheDocument();
  });
});
