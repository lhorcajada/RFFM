import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetInjuryProtocol = vi.fn();
const mockUpdateInjuryProtocol = vi.fn();
const mockDeleteInjuryProtocol = vi.fn();
vi.mock("../../../../services/injuryProtocolService", () => ({
  getInjuryProtocol: (...args: unknown[]) => mockGetInjuryProtocol(...args),
  updateInjuryProtocol: (...args: unknown[]) => mockUpdateInjuryProtocol(...args),
  deleteInjuryProtocol: (...args: unknown[]) => mockDeleteInjuryProtocol(...args),
}));

import InjuryProtocolPanel from "../InjuryProtocolPanel";

function dispatchedSnackbars(): { message: string; severity: string }[] {
  return (window as any).__snackbars ?? [];
}

beforeEach(() => {
  vi.clearAllMocks();
  (window as any).__snackbars = [];
  window.addEventListener("rffm.show_snackbar", (e: Event) => {
    (window as any).__snackbars.push((e as CustomEvent).detail);
  });
});

describe("InjuryProtocolPanel", () => {
  it("un coach ve el editor y los botones Guardar y Eliminar protocolo", async () => {
    mockGetInjuryProtocol.mockResolvedValue({
      teamId: "team-1",
      content: "<p>Contenido actual</p>",
      updatedAt: "2026-01-01T00:00:00Z",
      attachments: [],
    });

    render(<InjuryProtocolPanel teamId="team-1" isCoach={true} />);

    await waitFor(() => expect(mockGetInjuryProtocol).toHaveBeenCalledWith("team-1"));

    expect(await screen.findByRole("button", { name: /guardar/i })).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: /eliminar protocolo/i })
    ).toBeInTheDocument();
  });

  it("un rol distinto de coach ve el contenido en solo lectura sin controles de edición", async () => {
    mockGetInjuryProtocol.mockResolvedValue({
      teamId: "team-1",
      content: "<p>Contenido actual</p>",
      updatedAt: "2026-01-01T00:00:00Z",
      attachments: [],
    });

    render(<InjuryProtocolPanel teamId="team-1" isCoach={false} />);

    await waitFor(() => expect(mockGetInjuryProtocol).toHaveBeenCalledWith("team-1"));
    await screen.findByText("Contenido actual");

    expect(screen.queryByRole("button", { name: /guardar/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /eliminar protocolo/i })
    ).not.toBeInTheDocument();
  });

  it("muestra un estado vacío de solo lectura cuando no hay protocolo todavía", async () => {
    mockGetInjuryProtocol.mockResolvedValue({
      teamId: "team-1",
      content: null,
      updatedAt: null,
      attachments: [],
    });

    render(<InjuryProtocolPanel teamId="team-1" isCoach={false} />);

    await waitFor(() => expect(mockGetInjuryProtocol).toHaveBeenCalledWith("team-1"));

    expect(
      await screen.findByText(/no hay ningún protocolo/i)
    ).toBeInTheDocument();
  });

  it("guardar llama al servicio de actualización y muestra un snackbar de éxito", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    mockGetInjuryProtocol.mockResolvedValue({
      teamId: "team-1",
      content: "<p>Contenido actual</p>",
      updatedAt: "2026-01-01T00:00:00Z",
      attachments: [],
    });
    mockUpdateInjuryProtocol.mockResolvedValue({
      teamId: "team-1",
      content: "<p>Contenido actual</p>",
      updatedAt: "2026-01-02T00:00:00Z",
      attachments: [],
    });

    render(<InjuryProtocolPanel teamId="team-1" isCoach={true} />);

    const saveButton = await screen.findByRole("button", { name: /guardar/i });
    await userEvent.click(saveButton);

    await waitFor(() => expect(mockUpdateInjuryProtocol).toHaveBeenCalledTimes(1));
    expect(mockUpdateInjuryProtocol.mock.calls[0][0]).toBe("team-1");
    await waitFor(() =>
      expect(dispatchedSnackbars().some((s) => s.severity === "success")).toBe(true)
    );
  });

  it("eliminar protocolo abre un ConfirmDialog y solo llama al servicio al confirmar", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    mockGetInjuryProtocol.mockResolvedValue({
      teamId: "team-1",
      content: "<p>Contenido actual</p>",
      updatedAt: "2026-01-01T00:00:00Z",
      attachments: [],
    });
    mockDeleteInjuryProtocol.mockResolvedValue(undefined);

    render(<InjuryProtocolPanel teamId="team-1" isCoach={true} />);

    const deleteButton = await screen.findByRole("button", { name: /eliminar protocolo/i });
    await userEvent.click(deleteButton);

    expect(mockDeleteInjuryProtocol).not.toHaveBeenCalled();
    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    const confirmButtons = screen.getAllByRole("button", { name: /eliminar/i });
    await userEvent.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => expect(mockDeleteInjuryProtocol).toHaveBeenCalledWith("team-1"));
  });
});
