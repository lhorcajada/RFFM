import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
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

const useRecentSessionsMock = vi.fn();
vi.mock("../../../hooks/useRecentSessions", () => ({
  useRecentSessions: () => useRecentSessionsMock(),
}));

vi.mock("../../../hooks/useSessionDetail", () => ({
  useSessionDetail: () => ({ detail: null, loading: false }),
}));

vi.mock("../../../hooks/usePlayerSessionAttendance", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../hooks/usePlayerSessionAttendance")>()),
  usePlayerSessionAttendance: () => ({ attendance: "attended", loading: false }),
}));

import PlayerTrackingPanel from "../PlayerTrackingPanel";

const RECENT_SESSION = {
  id: "ses-1",
  name: "Sesión 1",
  description: "",
  date: "2026-09-28T00:00:00",
  startTime: null,
  sportEventId: "ev-1",
  isAssociatedToPlan: false,
  exerciseCount: 0,
  targets: [
    {
      subSubPrincipioId: "ssp-231",
      rol: "Extremo: fijar por dentro",
      numero: "2.3.1",
      subprincipioId: "s-23",
      subprincipioTitulo: "Circular para desordenar",
      zonaId: null,
      zonaLabel: null,
      principioId: "p-2",
      principioTitulo: "Ataque posicional",
      gameMomentId: 2,
      gameMomentName: "Ataque organizado",
    },
    {
      subSubPrincipioId: "ssp-411",
      rol: "Todos: asegurar el pase",
      numero: "4.1.1",
      subprincipioId: "s-41",
      subprincipioTitulo: "Asegurar tras robo",
      zonaId: null,
      zonaLabel: null,
      principioId: "p-4",
      principioTitulo: "Transición tras robo",
      gameMomentId: 4,
      gameMomentName: "Transición defensa-ataque",
    },
  ],
};

async function selectSession() {
  await userEvent.click(screen.getByRole("combobox", { name: /sesión/i }));
  await userEvent.click(await screen.findByRole("option", { name: "28/09 · Sesión 1" }));
}

async function rateInSession(title: string, label: string) {
  await userEvent.click(within(screen.getByRole("group", { name: title })).getByRole("button", { name: label }));
}

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
  trainingSessionId: null,
  trainingSessionName: null,
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
    useRecentSessionsMock.mockReturnValue({ sessions: [], loading: false });
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

  it("sin sesiones recientes no muestra el selector de sesión", async () => {
    render(<PlayerTrackingPanel teamId="team-1" teamPlayerId="tp-1" />);
    await screen.findByText("Aún no hay observaciones para este jugador");

    expect(screen.queryByRole("combobox", { name: /sesión/i })).not.toBeInTheDocument();
  });

  it("al elegir una sesión cambia al formulario de valorar la sesión", async () => {
    useRecentSessionsMock.mockReturnValue({ sessions: [RECENT_SESSION], loading: false });
    render(<PlayerTrackingPanel teamId="team-1" teamPlayerId="tp-1" />);
    expect(screen.getByLabelText(/fecha/i)).toBeInTheDocument();

    await selectSession();

    expect(screen.getByRole("region", { name: "Valorar la sesión" })).toBeInTheDocument();
    expect(screen.queryByLabelText(/fecha/i)).not.toBeInTheDocument();
  });

  it("al guardar la sesión crea una observación por subprincipio valorado y avisa", async () => {
    useRecentSessionsMock.mockReturnValue({ sessions: [RECENT_SESSION], loading: false });
    createPlayerObservationMock
      .mockResolvedValueOnce({ ...CREATED, id: "obs-a", date: "2026-09-28" })
      .mockResolvedValueOnce({ ...CREATED, id: "obs-b", date: "2026-09-28", subprincipioLabel: "4.1 Asegurar tras robo" });
    render(<PlayerTrackingPanel teamId="team-1" teamPlayerId="tp-1" />);
    await screen.findByText("Aún no hay observaciones para este jugador");
    await selectSession();

    await rateInSession("Circular para desordenar", "No lo hace");
    await rateInSession("Asegurar tras robo", "A veces");
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(createPlayerObservationMock).toHaveBeenCalledTimes(2));
    expect(createPlayerObservationMock).toHaveBeenNthCalledWith(1, "team-1", "tp-1", expect.objectContaining({ subprincipioId: "s-23", date: "2026-09-28" }));
    expect(createPlayerObservationMock).toHaveBeenNthCalledWith(2, "team-1", "tp-1", expect.objectContaining({ subprincipioId: "s-41", date: "2026-09-28" }));
    expect(await screen.findByText("4.1 Asegurar tras robo")).toBeInTheDocument();
    const event = snackbarListener.mock.calls[0][0] as CustomEvent;
    expect(event.detail).toEqual({ message: "2 observaciones guardadas", severity: "success" });
  });

  it("si falla alguna observación de la sesión avisa con el error", async () => {
    useRecentSessionsMock.mockReturnValue({ sessions: [RECENT_SESSION], loading: false });
    createPlayerObservationMock
      .mockResolvedValueOnce({ ...CREATED, id: "obs-a" })
      .mockRejectedValueOnce({ response: { data: { detail: "Subprincipio no encontrado" } } });
    render(<PlayerTrackingPanel teamId="team-1" teamPlayerId="tp-1" />);
    await screen.findByText("Aún no hay observaciones para este jugador");
    await selectSession();

    await rateInSession("Circular para desordenar", "No lo hace");
    await rateInSession("Asegurar tras robo", "A veces");
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(snackbarListener).toHaveBeenCalled());
    const event = snackbarListener.mock.calls[0][0] as CustomEvent;
    expect(event.detail).toEqual({ message: "Subprincipio no encontrado", severity: "error" });
    expect(
      within(screen.getByRole("group", { name: "Asegurar tras robo" })).getByRole("button", { name: "A veces" }),
    ).toHaveAttribute("aria-pressed", "true");
  });
});
