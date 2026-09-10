import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getConvocationNotificationRecipientsMock = vi.fn();
vi.mock("../../../../services/convocationNotificationService", () => ({
  default: {
    getConvocationNotificationRecipients: (...args: unknown[]) =>
      getConvocationNotificationRecipientsMock(...args),
  },
  getConvocationNotificationRecipients: (...args: unknown[]) =>
    getConvocationNotificationRecipientsMock(...args),
}));

import NotifyPendingConvocationDialog from "../NotifyPendingConvocationDialog";

const eventSummary = {
  eventTypeLabel: "Partido",
  rivalName: "CD Rival",
  dateES: "Domingo, 12 de octubre de 2026",
  time: "10:00",
  location: "Campo Municipal",
};

function renderDialog(overrides: Partial<React.ComponentProps<typeof NotifyPendingConvocationDialog>> = {}) {
  return render(
    <NotifyPendingConvocationDialog
      open={true}
      onClose={vi.fn()}
      eventId="event-1"
      teamPlayerIds={["p1", "p2"]}
      eventSummary={eventSummary}
      {...overrides}
    />
  );
}

describe("NotifyPendingConvocationDialog", () => {
  let windowOpenSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    windowOpenSpy = vi.spyOn(window, "open").mockImplementation(() => null);
  });

  it("muestra un estado de carga mientras se obtienen los destinatarios", async () => {
    getConvocationNotificationRecipientsMock.mockReturnValue(new Promise(() => {}));

    renderDialog();

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("muestra un botón de WhatsApp por cada familiar de un jugador con destinatarios", async () => {
    getConvocationNotificationRecipientsMock.mockResolvedValue([
      {
        teamPlayerId: "p1",
        playerAlias: "Juanito",
        familyMembers: [
          { familyMemberId: "fm-1", name: "María", lastName: "López", phone: "+34600111222", familyMember: "Madre" },
          { familyMemberId: "fm-2", name: "Pedro", lastName: "López", phone: "+34600333444", familyMember: "Padre" },
        ],
      },
    ]);

    renderDialog({ teamPlayerIds: ["p1"] });

    expect(await screen.findByRole("button", { name: /Madre: María López/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Padre: Pedro López/i })).toBeInTheDocument();
  });

  it("muestra un aviso mudo sin botón para un jugador sin destinatarios", async () => {
    getConvocationNotificationRecipientsMock.mockResolvedValue([
      { teamPlayerId: "p1", playerAlias: "Juanito", familyMembers: [] },
    ]);

    renderDialog({ teamPlayerIds: ["p1"] });

    expect(await screen.findByText(/Sin familiar con cuenta registrada y teléfono/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /WhatsApp/i })).not.toBeInTheDocument();
  });

  it("muestra la línea de resumen solo cuando al menos un jugador seleccionado no tiene destinatarios", async () => {
    getConvocationNotificationRecipientsMock.mockResolvedValue([
      {
        teamPlayerId: "p1",
        playerAlias: "Juanito",
        familyMembers: [
          { familyMemberId: "fm-1", name: "María", lastName: "López", phone: "+34600111222", familyMember: "Madre" },
        ],
      },
      { teamPlayerId: "p2", playerAlias: "Pedrito", familyMembers: [] },
    ]);

    renderDialog({ teamPlayerIds: ["p1", "p2"] });

    expect(await screen.findByText(/1 de 2 jugadores seleccionados tienen un familiar al que notificar/i)).toBeInTheDocument();
  });

  it("no muestra la línea de resumen cuando todos los jugadores seleccionados tienen destinatarios", async () => {
    getConvocationNotificationRecipientsMock.mockResolvedValue([
      {
        teamPlayerId: "p1",
        playerAlias: "Juanito",
        familyMembers: [
          { familyMemberId: "fm-1", name: "María", lastName: "López", phone: "+34600111222", familyMember: "Madre" },
        ],
      },
    ]);

    renderDialog({ teamPlayerIds: ["p1"] });

    await screen.findByRole("button", { name: /Madre: María López/i });
    expect(screen.queryByText(/jugadores seleccionados tienen un familiar/i)).not.toBeInTheDocument();
  });

  it("al pulsar el botón de un familiar abre window.open con una URL wa.me construida a partir del mensaje, y no abre los demás automáticamente", async () => {
    getConvocationNotificationRecipientsMock.mockResolvedValue([
      {
        teamPlayerId: "p1",
        playerAlias: "Juanito",
        familyMembers: [
          { familyMemberId: "fm-1", name: "María", lastName: "López", phone: "+34600111222", familyMember: "Madre" },
          { familyMemberId: "fm-2", name: "Pedro", lastName: "López", phone: "+34600333444", familyMember: "Padre" },
        ],
      },
    ]);
    const user = userEvent.setup();

    renderDialog({ teamPlayerIds: ["p1"] });

    const madreBtn = await screen.findByRole("button", { name: /Madre: María López/i });
    await user.click(madreBtn);

    expect(windowOpenSpy).toHaveBeenCalledTimes(1);
    const [url, target, features] = windowOpenSpy.mock.calls[0];
    expect(url).toMatch(/^https:\/\/wa\.me\/34600111222\?text=/);
    expect(target).toBe("_blank");
    expect(features).toBe("noopener,noreferrer");
  });

  it("marca el botón pulsado como 'Abierto' tras el clic", async () => {
    getConvocationNotificationRecipientsMock.mockResolvedValue([
      {
        teamPlayerId: "p1",
        playerAlias: "Juanito",
        familyMembers: [
          { familyMemberId: "fm-1", name: "María", lastName: "López", phone: "+34600111222", familyMember: "Madre" },
        ],
      },
    ]);
    const user = userEvent.setup();

    renderDialog({ teamPlayerIds: ["p1"] });

    const madreBtn = await screen.findByRole("button", { name: /Madre: María López/i });
    await user.click(madreBtn);

    expect(await screen.findByRole("button", { name: /Abierto/i })).toBeInTheDocument();
  });

  it("reinicia el estado 'Abierto' cuando el diálogo se vuelve a abrir", async () => {
    getConvocationNotificationRecipientsMock.mockResolvedValue([
      {
        teamPlayerId: "p1",
        playerAlias: "Juanito",
        familyMembers: [
          { familyMemberId: "fm-1", name: "María", lastName: "López", phone: "+34600111222", familyMember: "Madre" },
        ],
      },
    ]);
    const user = userEvent.setup();

    const { rerender } = renderDialog({ teamPlayerIds: ["p1"] });
    const madreBtn = await screen.findByRole("button", { name: /Madre: María López/i });
    await user.click(madreBtn);
    await screen.findByRole("button", { name: /Abierto/i });

    rerender(
      <NotifyPendingConvocationDialog
        open={false}
        onClose={vi.fn()}
        eventId="event-1"
        teamPlayerIds={["p1"]}
        eventSummary={eventSummary}
      />
    );
    rerender(
      <NotifyPendingConvocationDialog
        open={true}
        onClose={vi.fn()}
        eventId="event-1"
        teamPlayerIds={["p1"]}
        eventSummary={eventSummary}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Madre: María López/i })).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: /Abierto/i })).not.toBeInTheDocument();
  });

  it("muestra un estado de error en línea, sin fallar, cuando la petición falla", async () => {
    getConvocationNotificationRecipientsMock.mockRejectedValue(new Error("network error"));

    renderDialog();

    expect(await screen.findByText(/Error al cargar los destinatarios/i)).toBeInTheDocument();
  });
});
