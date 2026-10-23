import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PendingSanctionsWhatsAppDialog from "../PendingSanctionsWhatsAppDialog";

const MESSAGE = "*Sanciones pendientes*\n\n*Juan Pérez*\n• Expulsión – 10,00 € pendientes";

function setNavigatorProp(name: "clipboard" | "share", value: unknown) {
  Object.defineProperty(navigator, name, { value, configurable: true, writable: true });
}

describe("PendingSanctionsWhatsAppDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setNavigatorProp("share", undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("muestra el mensaje del listado en el diálogo", () => {
    render(<PendingSanctionsWhatsAppDialog open message={MESSAGE} onClose={vi.fn()} />);

    expect(screen.getByRole("textbox", { name: /mensaje para whatsapp/i })).toHaveValue(MESSAGE);
  });

  it("copia el mensaje al portapapeles", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setNavigatorProp("clipboard", { writeText });
    render(<PendingSanctionsWhatsAppDialog open message={MESSAGE} onClose={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /copiar/i }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(MESSAGE));
  });

  it("usa el menú nativo de compartir cuando el dispositivo lo soporta", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setNavigatorProp("share", share);
    render(<PendingSanctionsWhatsAppDialog open message={MESSAGE} onClose={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /compartir/i }));

    expect(share).toHaveBeenCalledWith({ text: MESSAGE });
  });

  it("abre WhatsApp con el mensaje cuando no hay menú nativo de compartir", async () => {
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);
    render(<PendingSanctionsWhatsAppDialog open message={MESSAGE} onClose={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /compartir/i }));

    expect(openSpy).toHaveBeenCalledWith(
      `https://wa.me/?text=${encodeURIComponent(MESSAGE)}`,
      "_blank",
      "noopener"
    );
  });
});
