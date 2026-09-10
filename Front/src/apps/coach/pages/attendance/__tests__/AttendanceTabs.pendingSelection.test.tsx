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

const notifyDialogPropsSpy = vi.fn();
vi.mock("../components/NotifyPendingConvocationDialog", () => ({
  default: (props: any) => {
    notifyDialogPropsSpy(props);
    return props.open ? <div data-testid="notify-dialog">Notify dialog open</div> : null;
  },
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

function setup() {
  getEventPlayersMock.mockResolvedValue([]);
  getConvocationsMock.mockResolvedValue([
    pendingConv("p1", "Pendiente Uno"),
    pendingConv("p2", "Pendiente Dos"),
  ]);
}

async function renderTabsAndExpandPending(eventId = "event-1") {
  render(
    <MemoryRouter>
      <AttendanceTabs eventId={eventId} eventStart={null} isMatch={false} />
    </MemoryRouter>
  );
  const header = await screen.findByRole("button", { name: /^Pendientes de aceptar/i });
  await userEvent.click(header);
  await screen.findByText("Pendiente Uno");
  return header;
}

describe("AttendanceTabs - selección de pendientes para notificar por WhatsApp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notifyDialogPropsSpy.mockClear();
    setup();
  });

  it("el botón 'Notificar por WhatsApp' está deshabilitado cuando no hay selección", async () => {
    await renderTabsAndExpandPending();

    const notifyButton = screen.getByRole("button", { name: /Notificar por WhatsApp/i });
    expect(notifyButton).toBeDisabled();
  });

  it("seleccionar una card pendiente individual habilita el botón de notificar", async () => {
    await renderTabsAndExpandPending();

    const checkbox = screen.getByRole("checkbox", { name: /Seleccionar a Pendiente Uno/i });
    await userEvent.click(checkbox);

    const notifyButton = screen.getByRole("button", { name: /Notificar por WhatsApp/i });
    expect(notifyButton).not.toBeDisabled();
  });

  it("'Seleccionar todos' selecciona todos los pendientes y queda en estado indeterminado si solo hay una selección parcial", async () => {
    await renderTabsAndExpandPending();

    const selectAll = screen.getByRole("checkbox", { name: /Seleccionar todos/i });
    await userEvent.click(selectAll);

    const cb1 = screen.getByRole("checkbox", { name: /Seleccionar a Pendiente Uno/i });
    const cb2 = screen.getByRole("checkbox", { name: /Seleccionar a Pendiente Dos/i });
    expect(cb1).toBeChecked();
    expect(cb2).toBeChecked();

    // Deselect one -> partial selection -> "select all" becomes indeterminate
    await userEvent.click(cb1);
    await waitFor(() => {
      expect(selectAll).toHaveAttribute("data-indeterminate", "true");
    });
  });

  it("'Seleccionar todos' deselecciona todos cuando ya estaban todos seleccionados", async () => {
    await renderTabsAndExpandPending();

    const selectAll = screen.getByRole("checkbox", { name: /Seleccionar todos/i });
    await userEvent.click(selectAll);
    await userEvent.click(selectAll);

    const notifyButton = screen.getByRole("button", { name: /Notificar por WhatsApp/i });
    expect(notifyButton).toBeDisabled();
  });

  it("la selección se reinicia cuando cambia eventId", async () => {
    const { rerender } = render(
      <MemoryRouter>
        <AttendanceTabs eventId="event-1" eventStart={null} isMatch={false} />
      </MemoryRouter>
    );
    const header = await screen.findByRole("button", { name: /^Pendientes de aceptar/i });
    await userEvent.click(header);
    await screen.findByText("Pendiente Uno");

    const checkbox = screen.getByRole("checkbox", { name: /Seleccionar a Pendiente Uno/i });
    await userEvent.click(checkbox);
    expect(screen.getByRole("button", { name: /Notificar por WhatsApp/i })).not.toBeDisabled();

    getConvocationsMock.mockResolvedValue([
      pendingConv("p3", "Pendiente Tres"),
    ]);

    rerender(
      <MemoryRouter>
        <AttendanceTabs eventId="event-2" eventStart={null} isMatch={false} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Notificar por WhatsApp/i })).toBeDisabled();
    });
  });

  it("abre NotifyPendingConvocationDialog con los teamPlayerIds seleccionados y el eventSummary recibido al pulsar 'Notificar por WhatsApp'", async () => {
    const eventSummary = {
      eventTypeLabel: "Partido",
      rivalName: "CD Rival",
      dateES: "Domingo, 12 de octubre de 2026",
      time: "10:00",
      location: "Campo Municipal",
    };

    render(
      <MemoryRouter>
        <AttendanceTabs eventId="event-1" eventStart={null} isMatch={false} eventSummary={eventSummary} />
      </MemoryRouter>
    );
    const header = await screen.findByRole("button", { name: /^Pendientes de aceptar/i });
    await userEvent.click(header);
    await screen.findByText("Pendiente Uno");

    await userEvent.click(screen.getByRole("checkbox", { name: /Seleccionar a Pendiente Uno/i }));
    await userEvent.click(screen.getByRole("button", { name: /Notificar por WhatsApp/i }));

    expect(await screen.findByTestId("notify-dialog")).toBeInTheDocument();
    const lastCallProps = notifyDialogPropsSpy.mock.calls[notifyDialogPropsSpy.mock.calls.length - 1][0];
    expect(lastCallProps.teamPlayerIds).toEqual(["p1"]);
    expect(lastCallProps.eventId).toBe("event-1");
    expect(lastCallProps.eventSummary).toEqual(eventSummary);
  });

  it("no falla cuando eventSummary no se proporciona (AttendanceTabs no intenta construir el mensaje por sí mismo)", async () => {
    await renderTabsAndExpandPending();

    await userEvent.click(screen.getByRole("checkbox", { name: /Seleccionar a Pendiente Uno/i }));
    await userEvent.click(screen.getByRole("button", { name: /Notificar por WhatsApp/i }));

    expect(await screen.findByTestId("notify-dialog")).toBeInTheDocument();
    const lastCallProps = notifyDialogPropsSpy.mock.calls[notifyDialogPropsSpy.mock.calls.length - 1][0];
    expect(lastCallProps.eventSummary).toBeUndefined();
  });
});
