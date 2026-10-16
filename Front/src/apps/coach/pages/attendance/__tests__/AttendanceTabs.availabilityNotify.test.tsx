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
    sendConvocationReminders: vi.fn(),
    addConvocation: vi.fn(),
    addConvocationsBulk: vi.fn(),
    updateConvocationStatus: vi.fn(),
    deleteConvocation: vi.fn(),
    deconvokeInjuredPlayers: vi.fn().mockResolvedValue(undefined),
  },
}));

const getAvailabilityRequestsMock = vi.fn();
const sendAvailabilityRemindersMock = vi.fn();

vi.mock("../../../services/availabilityService", () => ({
  default: {
    getAvailabilityRequests: (...args: unknown[]) => getAvailabilityRequestsMock(...args),
    sendAvailabilityReminders: (...args: unknown[]) => sendAvailabilityRemindersMock(...args),
    requestAvailability: vi.fn(),
    respondAvailability: vi.fn(),
    decideAvailable: vi.fn(),
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
  default: { getExcuseTypes: vi.fn().mockResolvedValue([]) },
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

vi.mock("../../../services/coachApi", () => ({
  getMyProfile: vi.fn().mockResolvedValue(null),
}));

const notifyDialogPropsSpy = vi.fn();
vi.mock("../components/NotifyPendingConvocationDialog", () => ({
  default: (props: { open: boolean; teamPlayerIds: string[]; kind?: string }) => {
    notifyDialogPropsSpy(props);
    return null;
  },
}));

import AttendanceTabs from "../AttendanceTabs";

const REQUESTED = { id: "tp-req", playerId: "p-req", alias: "Jugador Pendiente", position: "Defensa Central", isInjured: false };
const REQUESTS = [
  { id: "req-1", teamPlayerId: "tp-req", status: "Requested", requestedAt: "2026-10-09T10:00:00Z", respondedAt: null },
];

function setup(roles: string[]) {
  getRolesMock.mockReturnValue(roles);
  hasRoleMock.mockImplementation((role: string) => roles.includes(role));
  getEventPlayersMock.mockResolvedValue([REQUESTED]);
  getConvocationsMock.mockResolvedValue([]);
  getAvailabilityRequestsMock.mockResolvedValue(REQUESTS);
}

async function renderAndExpandPendingAnswers() {
  render(
    <MemoryRouter>
      <AttendanceTabs eventId="event-1" eventStart={null} isMatch isLeagueMatch />
    </MemoryRouter>
  );
  const toggle = await screen.findByRole("button", { name: /^Pendientes de respuesta/i });
  await userEvent.click(toggle);
  await screen.findByText("Jugador Pendiente");
}

describe("AttendanceTabs - notificar a los pendientes de respuesta de disponibilidad (partido de liga)", () => {
  let snackbarEvents: CustomEvent[];
  const onSnackbar = (e: Event) => snackbarEvents.push(e as CustomEvent);

  beforeEach(() => {
    vi.clearAllMocks();
    snackbarEvents = [];
    window.removeEventListener("rffm.show_snackbar", onSnackbar);
    window.addEventListener("rffm.show_snackbar", onSnackbar);
  });

  it("el entrenador ve los botones de WhatsApp y push deshabilitados mientras no hay selección", async () => {
    setup(["Coach"]);
    await renderAndExpandPendingAnswers();

    expect(screen.getByRole("button", { name: /Notificar por WhatsApp/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Notificar por push/i })).toBeDisabled();
  });

  it("al confirmar envía el recordatorio push de disponibilidad con los jugadores seleccionados", async () => {
    setup(["Coach"]);
    sendAvailabilityRemindersMock.mockResolvedValue({ notifiedCount: 1 });
    await renderAndExpandPendingAnswers();

    await userEvent.click(screen.getByRole("checkbox", { name: /Seleccionar a Jugador Pendiente/i }));
    await userEvent.click(screen.getByRole("button", { name: /Notificar por push/i }));
    await userEvent.click(await screen.findByRole("button", { name: /^Enviar$/i }));

    await waitFor(() => expect(sendAvailabilityRemindersMock).toHaveBeenCalledWith("event-1", ["tp-req"]));
    await waitFor(() =>
      expect(snackbarEvents.at(-1)?.detail).toEqual({ message: "Notificación enviada a 1 jugador", severity: "success" })
    );
  });

  it("muestra el detalle del backend si el envío push falla", async () => {
    setup(["Coach"]);
    sendAvailabilityRemindersMock.mockRejectedValue({ response: { data: { detail: "No tienes permiso" } } });
    await renderAndExpandPendingAnswers();

    await userEvent.click(screen.getByRole("checkbox", { name: /Seleccionar a Jugador Pendiente/i }));
    await userEvent.click(screen.getByRole("button", { name: /Notificar por push/i }));
    await userEvent.click(await screen.findByRole("button", { name: /^Enviar$/i }));

    await waitFor(() =>
      expect(snackbarEvents.at(-1)?.detail).toEqual({ message: "No tienes permiso", severity: "error" })
    );
  });

  it("abre el diálogo de WhatsApp en modo disponibilidad con los jugadores seleccionados", async () => {
    setup(["Coach"]);
    await renderAndExpandPendingAnswers();

    await userEvent.click(screen.getByRole("checkbox", { name: /Seleccionar todos los pendientes de respuesta/i }));
    await userEvent.click(screen.getByRole("button", { name: /Notificar por WhatsApp/i }));

    await waitFor(() =>
      expect(notifyDialogPropsSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ open: true, teamPlayerIds: ["tp-req"], kind: "availability" })
      )
    );
  });

  it("un jugador no ve las acciones de notificación ni la casilla de selección", async () => {
    setup(["Player"]);
    await renderAndExpandPendingAnswers();

    expect(screen.queryByRole("button", { name: /Notificar por WhatsApp/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Notificar por push/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /Seleccionar a Jugador Pendiente/i })).not.toBeInTheDocument();
  });
});
