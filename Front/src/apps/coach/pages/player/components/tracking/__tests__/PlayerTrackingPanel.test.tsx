import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PlayerObservation } from "../../../../../services/playerTrackingService";

const getPlayerObservationsMock = vi.fn();
const createPlayerObservationMock = vi.fn();
vi.mock("../../../../../services/playerTrackingService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../../services/playerTrackingService")>()),
  getPlayerObservations: (...args: unknown[]) => getPlayerObservationsMock(...args),
  createPlayerObservation: (...args: unknown[]) => createPlayerObservationMock(...args),
}));

vi.mock("../../../hooks/useSubprincipioOptions", () => ({
  useSubprincipioOptions: () => ({
    options: [{ id: "s-23", label: "2.3 Circular para desordenar", group: "Ataque organizado › 2. Ataque posicional" }],
    hasModel: true,
    loading: false,
  }),
}));

import PlayerTrackingPanel from "../PlayerTrackingPanel";

const CREATED: PlayerObservation = {
  id: "obs-1",
  date: "2026-09-30",
  kind: "GameModel",
  subprincipioId: "s-23",
  momentName: "Ataque organizado",
  principleLabel: "2. Ataque posicional",
  subprincipioLabel: "2.3 Circular para desordenar",
  assessment: "NotAchieved",
  comment: null,
  createdAt: "2026-09-30T18:00:00Z",
};

async function fillAndSave() {
  await userEvent.click(screen.getByRole("combobox", { name: /subprincipio/i }));
  await userEvent.click(await screen.findByRole("option", { name: "2.3 Circular para desordenar" }));
  await userEvent.click(screen.getByRole("button", { name: "No lo hace" }));
  await userEvent.click(screen.getByRole("button", { name: /guardar/i }));
}

describe("PlayerTrackingPanel", () => {
  const snackbarListener = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    getPlayerObservationsMock.mockResolvedValue([]);
    window.addEventListener("rffm.show_snackbar", snackbarListener);
  });

  afterEach(() => {
    window.removeEventListener("rffm.show_snackbar", snackbarListener);
  });

  it("al guardar avisa del éxito y muestra la observación en la lista", async () => {
    createPlayerObservationMock.mockResolvedValue(CREATED);
    render(<PlayerTrackingPanel teamId="team-1" teamPlayerId="tp-1" />);
    await screen.findByText("Aún no hay observaciones para este jugador");

    await fillAndSave();

    expect(await screen.findByText("30/09/2026")).toBeInTheDocument();
    expect(createPlayerObservationMock).toHaveBeenCalledWith("team-1", "tp-1", expect.objectContaining({ subprincipioId: "s-23" }));
    const event = snackbarListener.mock.calls[0][0] as CustomEvent;
    expect(event.detail).toEqual({ message: "Observación guardada", severity: "success" });
  });

  it("si falla el guardado avisa con el detalle del error", async () => {
    createPlayerObservationMock.mockRejectedValue({ response: { data: { detail: "Subprincipio no encontrado" } } });
    render(<PlayerTrackingPanel teamId="team-1" teamPlayerId="tp-1" />);
    await screen.findByText("Aún no hay observaciones para este jugador");

    await fillAndSave();

    await waitFor(() => expect(snackbarListener).toHaveBeenCalled());
    const event = snackbarListener.mock.calls[0][0] as CustomEvent;
    expect(event.detail).toEqual({ message: "Subprincipio no encontrado", severity: "error" });
  });

  it("si falla el guardado sin detalle usa el mensaje por defecto", async () => {
    createPlayerObservationMock.mockRejectedValue(new Error("network"));
    render(<PlayerTrackingPanel teamId="team-1" teamPlayerId="tp-1" />);
    await screen.findByText("Aún no hay observaciones para este jugador");

    await fillAndSave();

    await waitFor(() => expect(snackbarListener).toHaveBeenCalled());
    const event = snackbarListener.mock.calls[0][0] as CustomEvent;
    expect(event.detail).toEqual({ message: "No se pudo guardar la observación", severity: "error" });
  });
});
