import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
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
    deconvokeInjuredPlayers: vi.fn().mockResolvedValue(undefined),
  },
}));

const getAvailabilityRequestsMock = vi.fn();
const requestAvailabilityMock = vi.fn();
const respondAvailabilityMock = vi.fn();
const decideAvailableMock = vi.fn();

vi.mock("../../../services/availabilityService", () => ({
  default: {
    getAvailabilityRequests: (...args: unknown[]) => getAvailabilityRequestsMock(...args),
    requestAvailability: (...args: unknown[]) => requestAvailabilityMock(...args),
    respondAvailability: (...args: unknown[]) => respondAvailabilityMock(...args),
    decideAvailable: (...args: unknown[]) => decideAvailableMock(...args),
  },
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
  default: {
    getExcuseTypes: vi.fn().mockResolvedValue([
      { id: 1, name: "Lesión", justified: true },
      { id: 3, name: "Enfermedad", justified: true },
      { id: 7, name: "Decisión técnica", justified: false },
      { id: 8, name: "Sanción deportiva", justified: true },
    ]),
  },
}));

vi.mock("../../../services/assistanceTypeService", () => ({
  default: { getAssistanceTypes: vi.fn().mockResolvedValue([]), updateConvocationAssistance: vi.fn() },
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

const WAITING = { id: "tp-wait", playerId: "p-wait", alias: "Jugador Espera", position: "Portero", isInjured: false };
const REQUESTED = { id: "tp-req", playerId: "p-req", alias: "Jugador Pendiente", position: "Defensa Central", isInjured: false };
const AVAILABLE = { id: "tp-av", playerId: "p-av", alias: "Jugador Disponible", position: "Delantero Centro", isInjured: false };

const REQUESTS = [
  { id: "req-1", teamPlayerId: "tp-req", status: "Requested", requestedAt: "2026-10-09T10:00:00Z", respondedAt: null },
  { id: "req-2", teamPlayerId: "tp-av", status: "Available", requestedAt: "2026-10-09T10:00:00Z", respondedAt: "2026-10-09T11:00:00Z" },
];

function setup(roles: string[], ownTeamPlayerId = "tp-req") {
  getRolesMock.mockReturnValue(roles);
  hasRoleMock.mockImplementation((role: string) => roles.includes(role));
  getMyProfileMock.mockResolvedValue({ roleName: roles[0], playerId: ownTeamPlayerId });
  getEventPlayersMock.mockResolvedValue([WAITING, REQUESTED, AVAILABLE]);
  getConvocationsMock.mockResolvedValue([]);
  getAvailabilityRequestsMock.mockResolvedValue(REQUESTS);
  requestAvailabilityMock.mockResolvedValue({ requestedCount: 1 });
  respondAvailabilityMock.mockResolvedValue(undefined);
  decideAvailableMock.mockResolvedValue(undefined);
}

function renderTabs(props: { isLeagueMatch?: boolean; isMatch?: boolean } = { isLeagueMatch: true, isMatch: true }) {
  render(
    <MemoryRouter>
      <AttendanceTabs eventId="event-1" eventStart={null} {...props} />
    </MemoryRouter>
  );
}

async function expandGroup(name: RegExp) {
  const toggle = await screen.findByRole("button", { name });
  if (toggle.getAttribute("aria-expanded") !== "true") await userEvent.click(toggle);
}

function cardOf(alias: string): HTMLElement {
  return screen.getByText(alias).closest(`[data-testid="availability-card"]`) as HTMLElement;
}

describe("AttendanceTabs - disponibilidad en partidos de liga", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra «Pedir disponibilidad» en lugar de «Convocar toda la lista de espera» en un partido de liga", async () => {
    setup(["Coach"]);
    renderTabs();

    expect(await screen.findByRole("button", { name: "Pedir disponibilidad" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Convocar toda la lista de espera" })).not.toBeInTheDocument();
  });

  it("mantiene «Convocar toda la lista de espera» y no carga disponibilidad en un amistoso", async () => {
    setup(["Coach"]);
    renderTabs({ isMatch: false, isLeagueMatch: false });

    expect(await screen.findByRole("button", { name: "Convocar toda la lista de espera" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Pendientes de respuesta/i })).not.toBeInTheDocument();
    expect(getAvailabilityRequestsMock).not.toHaveBeenCalled();
  });

  it("pide disponibilidad tras confirmar y avisa con un snackbar", async () => {
    setup(["Coach"]);
    const snackbar = vi.fn();
    window.addEventListener("rffm.show_snackbar", snackbar);
    renderTabs();

    await userEvent.click(await screen.findByRole("button", { name: "Pedir disponibilidad" }));
    await userEvent.click(await screen.findByRole("button", { name: "Pedir" }));

    await waitFor(() => expect(requestAvailabilityMock).toHaveBeenCalledWith("event-1"));
    await waitFor(() => expect(snackbar).toHaveBeenCalled());
    window.removeEventListener("rffm.show_snackbar", snackbar);
  });

  it("separa a los jugadores en lista de espera, pendientes de respuesta y disponibles", async () => {
    setup(["Coach"]);
    renderTabs();

    await expandGroup(/^Lista de espera/i);
    await expandGroup(/^Pendientes de respuesta/i);
    await expandGroup(/^Disponibles/i);

    const pendingGroup = screen.getByRole("button", { name: /^Pendientes de respuesta/i });
    expect(within(pendingGroup).getByText("1")).toBeInTheDocument();
    expect(screen.getByText("Jugador Pendiente")).toBeInTheDocument();
    expect(screen.getByText("Jugador Disponible")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Lista de espera/i })).toHaveTextContent("1");
  });

  it("el entrenador convoca a un jugador disponible", async () => {
    setup(["Coach"]);
    renderTabs();
    await expandGroup(/^Disponibles/i);

    await userEvent.click(within(cardOf("Jugador Disponible")).getByRole("button", { name: "Convocar" }));

    await waitFor(() => expect(decideAvailableMock).toHaveBeenCalledWith("event-1", "req-2", true));
  });

  it("el entrenador desconvoca a un jugador disponible por decisión técnica tras confirmar", async () => {
    setup(["Coach"]);
    renderTabs();
    await expandGroup(/^Disponibles/i);

    await userEvent.click(within(cardOf("Jugador Disponible")).getByRole("button", { name: "Desconvocar" }));
    expect(await screen.findByText(/decisión técnica/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Desconvocar" }));

    await waitFor(() => expect(decideAvailableMock).toHaveBeenCalledWith("event-1", "req-2", false));
  });

  it("el entrenador confirma la disponibilidad de un jugador pendiente de respuesta", async () => {
    setup(["Coach"]);
    renderTabs();
    await expandGroup(/^Pendientes de respuesta/i);

    await userEvent.click(within(cardOf("Jugador Pendiente")).getByRole("button", { name: "Disponible" }));

    await waitFor(() => expect(respondAvailabilityMock).toHaveBeenCalledWith("event-1", "req-1", true));
  });

  it("el entrenador marca como no disponible a un jugador pendiente indicando el motivo", async () => {
    setup(["Coach"]);
    renderTabs();
    await expandGroup(/^Pendientes de respuesta/i);

    await userEvent.click(within(cardOf("Jugador Pendiente")).getByRole("button", { name: "No disponible" }));
    await screen.findByText("¿Por qué no está disponible?");
    expect(screen.queryByText("Decisión técnica")).not.toBeInTheDocument();
    await userEvent.click(screen.getByText("Enfermedad"));
    await userEvent.click(screen.getAllByRole("button", { name: "No disponible" }).at(-1)!);

    await waitFor(() => expect(respondAvailabilityMock).toHaveBeenCalledWith("event-1", "req-1", false, 3));
  });

  it("el jugador confirma que está disponible", async () => {
    setup(["Player"]);
    renderTabs();

    await userEvent.click(await screen.findByRole("button", { name: "Sí, disponible" }));

    await waitFor(() => expect(respondAvailabilityMock).toHaveBeenCalledWith("event-1", "req-1", true));
  });

  it("el jugador indica que no está disponible con un motivo que no es de entrenador", async () => {
    setup(["Player"]);
    renderTabs();

    await userEvent.click(await screen.findByRole("button", { name: "No disponible" }));

    await screen.findByText("¿Por qué no está disponible?");
    expect(screen.queryByText("Decisión técnica")).not.toBeInTheDocument();
    expect(screen.queryByText("Sanción deportiva")).not.toBeInTheDocument();
    const confirm = screen.getAllByRole("button", { name: "No disponible" }).at(-1)!;
    expect(confirm).toBeDisabled();

    await userEvent.click(screen.getByText("Enfermedad"));
    await userEvent.click(confirm);

    await waitFor(() => expect(respondAvailabilityMock).toHaveBeenCalledWith("event-1", "req-1", false, 3));
  });

  it("el jugador no ve los botones de respuesta en la tarjeta de otro jugador", async () => {
    setup(["Player"], "tp-other");
    renderTabs();
    await expandGroup(/^Pendientes de respuesta/i);

    expect(screen.getByText("Jugador Pendiente")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sí, disponible" })).not.toBeInTheDocument();
  });
});
