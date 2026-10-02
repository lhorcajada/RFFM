import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PlayerSessionListItem, SaveSessionEvaluationItem } from "../../../../../services/playerTrackingService";

const getSessionEvaluationsMock = vi.fn();
const saveSessionEvaluationMock = vi.fn();
const deleteSessionEvaluationMock = vi.fn();
vi.mock("../../../../../services/playerTrackingService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../../services/playerTrackingService")>()),
  getSessionEvaluations: (...args: unknown[]) => getSessionEvaluationsMock(...args),
  saveSessionEvaluation: (...args: unknown[]) => saveSessionEvaluationMock(...args),
  deleteSessionEvaluation: (...args: unknown[]) => deleteSessionEvaluationMock(...args),
}));

const ITEMS_TO_SAVE: SaveSessionEvaluationItem[] = [{ subprincipioId: "s-23", assessment: "NotAchieved", comment: null }];

vi.mock("../SessionEvaluationDialog", () => ({
  default: ({
    open,
    initialSessionId,
    onSubmit,
    onClose,
  }: {
    open: boolean;
    initialSessionId: string | null;
    onSubmit: (sessionId: string, items: SaveSessionEvaluationItem[]) => Promise<void>;
    onClose: () => void;
  }) =>
    open ? (
      <div role="dialog" aria-label="Seguimiento de la sesión">
        <span>{`dialogo:${initialSessionId ?? "nuevo"}`}</span>
        <button onClick={() => onSubmit(initialSessionId ?? "ses-1", ITEMS_TO_SAVE).catch(() => undefined)}>Guardar seguimiento</button>
        <button onClick={onClose}>Cerrar</button>
      </div>
    ) : null,
}));

import PlayerTrackingPanel from "../PlayerTrackingPanel";

function item(overrides: Partial<PlayerSessionListItem> = {}): PlayerSessionListItem {
  return {
    sessionId: "ses-1",
    name: "10. Desorganizar rival",
    date: "2026-10-01",
    isHeld: true,
    hasCalendarEvent: true,
    assistanceTypeId: 1,
    evaluation: null,
    ...overrides,
  };
}

const EVALUATED = item({ evaluation: { achieved: 0, partial: 1, notAchieved: 2, updatedAt: "2026-10-01T20:00:00Z" } });

describe("PlayerTrackingPanel", () => {
  const snackbarListener = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    getSessionEvaluationsMock.mockResolvedValue([item()]);
    window.addEventListener("rffm.show_snackbar", snackbarListener);
  });

  afterEach(() => {
    window.removeEventListener("rffm.show_snackbar", snackbarListener);
  });

  function lastSnackbar() {
    return (snackbarListener.mock.calls.at(-1)?.[0] as CustomEvent).detail;
  }

  it("muestra la lista de sesiones del jugador", async () => {
    render(<PlayerTrackingPanel teamId="team-1" teamPlayerId="tp-1" />);

    expect(await screen.findByRole("listitem", { name: "01/10/2026 · 10. Desorganizar rival" })).toBeInTheDocument();
    expect(getSessionEvaluationsMock).toHaveBeenCalledWith("team-1", "tp-1");
  });

  it("Crear abre el diálogo de esa sesión y al guardar recarga y avisa", async () => {
    saveSessionEvaluationMock.mockResolvedValue({ id: "ev-1" });
    render(<PlayerTrackingPanel teamId="team-1" teamPlayerId="tp-1" />);
    const card = await screen.findByRole("listitem", { name: "01/10/2026 · 10. Desorganizar rival" });

    await userEvent.click(within(card).getByRole("button", { name: "Crear" }));
    expect(screen.getByText("dialogo:ses-1")).toBeInTheDocument();

    getSessionEvaluationsMock.mockResolvedValue([EVALUATED]);
    await userEvent.click(screen.getByRole("button", { name: "Guardar seguimiento" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(saveSessionEvaluationMock).toHaveBeenCalledWith("team-1", "tp-1", "ses-1", ITEMS_TO_SAVE);
    expect(await screen.findByText("Valorado")).toBeInTheDocument();
    expect(lastSnackbar()).toEqual({ message: "Seguimiento guardado", severity: "success" });
  });

  it("si falla el guardado avisa con el detalle y mantiene el diálogo abierto", async () => {
    saveSessionEvaluationMock.mockRejectedValue({ response: { data: { detail: "Solo se pueden valorar los subprincipios trabajados en la sesión." } } });
    render(<PlayerTrackingPanel teamId="team-1" teamPlayerId="tp-1" />);
    const card = await screen.findByRole("listitem", { name: "01/10/2026 · 10. Desorganizar rival" });
    await userEvent.click(within(card).getByRole("button", { name: "Crear" }));

    await userEvent.click(screen.getByRole("button", { name: "Guardar seguimiento" }));

    await waitFor(() => expect(snackbarListener).toHaveBeenCalled());
    expect(lastSnackbar()).toEqual({ message: "Solo se pueden valorar los subprincipios trabajados en la sesión.", severity: "error" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("Nuevo seguimiento abre el diálogo sin sesión elegida", async () => {
    render(<PlayerTrackingPanel teamId="team-1" teamPlayerId="tp-1" />);
    await screen.findByRole("listitem", { name: "01/10/2026 · 10. Desorganizar rival" });

    await userEvent.click(screen.getByRole("button", { name: "Nuevo seguimiento" }));

    expect(screen.getByText("dialogo:nuevo")).toBeInTheDocument();
  });

  it("Editar abre el diálogo de la sesión valorada", async () => {
    getSessionEvaluationsMock.mockResolvedValue([EVALUATED]);
    render(<PlayerTrackingPanel teamId="team-1" teamPlayerId="tp-1" />);
    const card = await screen.findByRole("listitem", { name: "01/10/2026 · 10. Desorganizar rival" });

    await userEvent.click(within(card).getByRole("button", { name: "Editar" }));

    expect(screen.getByText("dialogo:ses-1")).toBeInTheDocument();
  });

  it("Eliminar pide confirmación y, al confirmar, borra, recarga y avisa", async () => {
    getSessionEvaluationsMock.mockResolvedValue([EVALUATED]);
    deleteSessionEvaluationMock.mockResolvedValue(undefined);
    render(<PlayerTrackingPanel teamId="team-1" teamPlayerId="tp-1" />);
    const card = await screen.findByRole("listitem", { name: "01/10/2026 · 10. Desorganizar rival" });

    await userEvent.click(within(card).getByRole("button", { name: "Eliminar" }));
    const confirm = await screen.findByRole("dialog");
    expect(within(confirm).getByText(/10\. Desorganizar rival/)).toBeInTheDocument();
    expect(deleteSessionEvaluationMock).not.toHaveBeenCalled();

    getSessionEvaluationsMock.mockResolvedValue([item()]);
    await userEvent.click(within(confirm).getByRole("button", { name: "Eliminar" }));

    await waitFor(() => expect(deleteSessionEvaluationMock).toHaveBeenCalledWith("team-1", "tp-1", "ses-1"));
    expect(await screen.findByText("Sin valorar")).toBeInTheDocument();
    expect(lastSnackbar()).toEqual({ message: "Seguimiento eliminado", severity: "success" });
  });

  it("cancelar la confirmación no borra", async () => {
    getSessionEvaluationsMock.mockResolvedValue([EVALUATED]);
    render(<PlayerTrackingPanel teamId="team-1" teamPlayerId="tp-1" />);
    const card = await screen.findByRole("listitem", { name: "01/10/2026 · 10. Desorganizar rival" });
    await userEvent.click(within(card).getByRole("button", { name: "Eliminar" }));

    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Cancelar" }));

    expect(deleteSessionEvaluationMock).not.toHaveBeenCalled();
  });
});
