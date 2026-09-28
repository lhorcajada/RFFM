import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getEventPlayersMock = vi.fn();
const getConvocationsMock = vi.fn();
const sendConvocationRemindersMock = vi.fn();

vi.mock("../../../services/convocationService", () => ({
  default: {
    getEventPlayers: (...args: unknown[]) => getEventPlayersMock(...args),
    getConvocations: (...args: unknown[]) => getConvocationsMock(...args),
    sendConvocationReminders: (...args: unknown[]) => sendConvocationRemindersMock(...args),
    addConvocation: vi.fn(),
    addConvocationsBulk: vi.fn(),
    updateConvocationStatus: vi.fn(),
    deleteConvocation: vi.fn(),
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
      { id: 3, name: "Deconvoke" },
    ]),
  },
}));

vi.mock("../../../services/excuseTypeService", () => ({
  default: { getExcuseTypes: vi.fn().mockResolvedValue([]) },
}));

vi.mock("../../../services/assistanceTypeService", () => ({
  default: {
    getAssistanceTypes: vi.fn().mockResolvedValue([]),
    updateConvocationAssistance: vi.fn(),
  },
}));

vi.mock("../../../services/authService", () => ({
  coachAuthService: {
    getRoles: () => ["Coach"],
    hasRole: (role: string) => role === "Coach",
    hasPermission: vi.fn().mockReturnValue(true),
    getToken: vi.fn().mockReturnValue("fake-token"),
  },
}));

vi.mock("../../../services/coachApi", () => ({
  getMyProfile: vi.fn().mockResolvedValue(null),
}));

vi.mock("../components/NotifyPendingConvocationDialog", () => ({
  default: () => null,
}));

import AttendanceTabs from "../AttendanceTabs";

function pendingConv(id: string, alias: string) {
  return {
    id: `conv-${id}`,
    player: { id, playerId: id, alias, urlPhoto: null, position: "DF" },
    status: 1,
    isInjured: false,
  };
}

async function renderAndSelectFirstPending() {
  render(
    <MemoryRouter>
      <AttendanceTabs eventId="event-1" eventStart={null} isMatch={false} />
    </MemoryRouter>
  );
  await userEvent.click(await screen.findByRole("button", { name: /^Pendientes de aceptar/i }));
  await screen.findByText("Pendiente Uno");
  await userEvent.click(screen.getByRole("checkbox", { name: /Seleccionar a Pendiente Uno/i }));
}

describe("AttendanceTabs - notificar por push a los pendientes seleccionados", () => {
  let snackbarEvents: CustomEvent[];
  const onSnackbar = (e: Event) => snackbarEvents.push(e as CustomEvent);

  beforeEach(() => {
    vi.clearAllMocks();
    snackbarEvents = [];
    window.removeEventListener("rffm.show_snackbar", onSnackbar);
    window.addEventListener("rffm.show_snackbar", onSnackbar);
    getEventPlayersMock.mockResolvedValue([]);
    getConvocationsMock.mockResolvedValue([
      pendingConv("p1", "Pendiente Uno"),
      pendingConv("p2", "Pendiente Dos"),
    ]);
  });

  it("el botón 'Notificar por push' está deshabilitado cuando no hay selección", async () => {
    render(
      <MemoryRouter>
        <AttendanceTabs eventId="event-1" eventStart={null} isMatch={false} />
      </MemoryRouter>
    );
    await userEvent.click(await screen.findByRole("button", { name: /^Pendientes de aceptar/i }));
    await screen.findByText("Pendiente Uno");

    expect(screen.getByRole("button", { name: /Notificar por push/i })).toBeDisabled();
  });

  it("pide confirmación antes de enviar y no envía nada si se cancela", async () => {
    await renderAndSelectFirstPending();

    await userEvent.click(screen.getByRole("button", { name: /Notificar por push/i }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Cancelar/i }));

    expect(sendConvocationRemindersMock).not.toHaveBeenCalled();
  });

  it("al confirmar envía el recordatorio push con los teamPlayerIds seleccionados y muestra un aviso de éxito", async () => {
    sendConvocationRemindersMock.mockResolvedValue({ notifiedCount: 1 });
    await renderAndSelectFirstPending();

    await userEvent.click(screen.getByRole("button", { name: /Notificar por push/i }));
    await userEvent.click(await screen.findByRole("button", { name: /^Enviar$/i }));

    await waitFor(() => {
      expect(sendConvocationRemindersMock).toHaveBeenCalledWith("event-1", ["p1"]);
    });
    await waitFor(() => {
      expect(snackbarEvents.at(-1)?.detail).toEqual({
        message: "Notificación enviada a 1 jugador",
        severity: "success",
      });
    });
  });

  it("muestra un aviso de error con el detalle del backend si el envío falla", async () => {
    sendConvocationRemindersMock.mockRejectedValue({ response: { data: { detail: "No tienes permiso" } } });
    await renderAndSelectFirstPending();

    await userEvent.click(screen.getByRole("button", { name: /Notificar por push/i }));
    await userEvent.click(await screen.findByRole("button", { name: /^Enviar$/i }));

    await waitFor(() => {
      expect(snackbarEvents.at(-1)?.detail).toEqual({ message: "No tienes permiso", severity: "error" });
    });
  });
});
