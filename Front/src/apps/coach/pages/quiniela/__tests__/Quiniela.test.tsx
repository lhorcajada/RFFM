import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { QuinielaCurrent, QuinielaMatch } from "../../../services/quinielaService";
import { UserProvider } from "../../../../../shared/context/UserContext";

vi.mock("../../../services/authService", () => ({
  coachAuthService: {
    getRoles: () => ["Player"],
    hasRole: (role: string) => role === "Player",
    hasPermission: vi.fn().mockReturnValue(true),
    getToken: vi.fn().mockReturnValue("fake-token"),
    isAuthenticated: vi.fn().mockReturnValue(true),
  },
}));

vi.mock("../../../services/coachApi", () => ({
  getMyProfile: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../../hooks/useTeamAndClub.tsx", () => ({
  default: () => ({ team: { id: "team-1", name: "Cadete B" }, teamTitleNode: null, clubSubtitleNode: null, loading: false }),
}));

vi.mock("../../../../../shared/hooks/useAuditPageAccess", () => ({ useAuditPageAccess: vi.fn() }));

const getCurrentQuiniela = vi.fn();
const saveQuinielaTicket = vi.fn();
const openQuiniela = vi.fn();
const deleteMyQuinielaTicket = vi.fn();
vi.mock("../../../services/quinielaService", () => ({
  deleteMyQuinielaTicket: (...args: unknown[]) => deleteMyQuinielaTicket(...args),
  getCurrentQuiniela: (...args: unknown[]) => getCurrentQuiniela(...args),
  saveQuinielaTicket: (...args: unknown[]) => saveQuinielaTicket(...args),
  openQuiniela: (...args: unknown[]) => openQuiniela(...args),
}));

import Quiniela from "../Quiniela";
import { isQuinielaNovelty } from "../../team-dashboard/utils/quinielaNovelty";

function match(overrides: Partial<QuinielaMatch>): QuinielaMatch {
  return {
    recordCode: "m1",
    homeTeam: "CD Los Olivos",
    awayTeam: "UD Sierra Norte",
    kickoffUtc: "2026-10-31T09:00:00Z",
    isValid: true,
    isPleno: false,
    homeGoals: null,
    awayGoals: null,
    isFinal: false,
    ...overrides,
  };
}

function current(overrides: Partial<QuinielaCurrent> = {}): QuinielaCurrent {
  return {
    isOpen: true,
    jornada: {
      id: "j1",
      teamId: "team-1",
      rffmRoundId: "r7",
      roundNumber: 7,
      roundName: "Jornada 7",
      price: 1,
      status: "Open",
      carryIn: 3.5,
      firstKickoffUtc: "2026-10-31T09:00:00Z",
      paymentDeadlineUtc: "2026-10-30T22:59:00Z",
      picksClosed: false,
    },
    matches: [
      match({ recordCode: "m1" }),
      match({ recordCode: "m2", homeTeam: "Real Valdemar", awayTeam: "CD Las Encinas" }),
      match({ recordCode: "m4", homeTeam: "FC Cañada", awayTeam: "Racing Soto", isValid: false }),
      match({
        recordCode: "m8",
        homeTeam: "Unión Robledo",
        awayTeam: "CD Fresnedillas",
        isPleno: true,
        kickoffUtc: "2026-11-01T11:30:00Z",
      }),
    ],
    myTicket: null,
    pool: { participants: 12, paidTickets: 8, collected: 8, prizePool: 11.5 },
    previous: null,
    canManage: false,
    ...overrides,
  };
}

function renderPage() {
  return render(
    <UserProvider>
      <MemoryRouter initialEntries={["/coach/quiniela?teamId=team-1"]}>
        <Quiniela />
      </MemoryRouter>
    </UserProvider>,
  );
}

function cardOf(text: string): HTMLElement {
  return screen.getByText(text).closest("[data-testid='match-card']") as HTMLElement;
}

describe("Quiniela", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra una tarjeta por partido con los equipos", async () => {
    getCurrentQuiniela.mockResolvedValue(current());
    renderPage();
    expect(await screen.findByText("CD Los Olivos")).toBeInTheDocument();
    expect(screen.getByText("Real Valdemar")).toBeInTheDocument();
    expect(screen.getByText("Unión Robledo")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("permite seleccionar 1, X o 2 en un partido", async () => {
    getCurrentQuiniela.mockResolvedValue(current());
    renderPage();
    await screen.findByText("CD Los Olivos");
    const card = cardOf("CD Los Olivos");
    const draw = within(card).getByRole("button", { name: /empate/i });
    expect(draw).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(draw);
    expect(within(card).getByRole("button", { name: /empate/i })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(within(card).getByRole("button", { name: /local/i }));
    expect(within(card).getByRole("button", { name: /empate/i })).toHaveAttribute("aria-pressed", "false");
  });

  it("el partido aplazado muestra «Aplazado · no cuenta» y no tiene pronóstico", async () => {
    getCurrentQuiniela.mockResolvedValue(current());
    renderPage();
    await screen.findByText("FC Cañada");
    const card = cardOf("FC Cañada");
    expect(within(card).getByText("Aplazado · no cuenta")).toBeInTheDocument();
    expect(within(card).queryByRole("button")).not.toBeInTheDocument();
  });

  it("el Pleno ofrece goles 0, 1, 2 y M para cada equipo", async () => {
    getCurrentQuiniela.mockResolvedValue(current());
    renderPage();
    await screen.findByText("Unión Robledo");
    const home = screen.getByRole("group", { name: "Goles de Unión Robledo" });
    expect(within(home).getAllByRole("button").map((b) => b.textContent)).toEqual(["0", "1", "2", "M"]);
    fireEvent.click(within(home).getByRole("button", { name: "M" }));
    expect(within(home).getByRole("button", { name: "M" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Pleno")).toBeInTheDocument();
  });

  it("muestra «aún no abierta» cuando no hay quiniela abierta", async () => {
    getCurrentQuiniela.mockResolvedValue(current({ isOpen: false, jornada: null, matches: [], pool: null }));
    renderPage();
    expect(await screen.findByText(/aún no está abierta/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /guardar boleto/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /abrir quiniela/i })).not.toBeInTheDocument();
  });

  it("el entrenador ve el acceso a la bolsa y pagos", async () => {
    getCurrentQuiniela.mockResolvedValue(current({ canManage: true }));
    renderPage();
    expect(await screen.findByRole("button", { name: /bolsa y pagos/i })).toBeInTheDocument();
  });

  it("el participante no ve el acceso a la bolsa y pagos", async () => {
    getCurrentQuiniela.mockResolvedValue(current({ canManage: false }));
    renderPage();
    await screen.findByText("CD Los Olivos");
    expect(screen.queryByRole("button", { name: /bolsa y pagos/i })).not.toBeInTheDocument();
  });

  it("el entrenador puede abrir la quiniela desde el estado no abierta", async () => {
    getCurrentQuiniela.mockResolvedValueOnce(
      current({ isOpen: false, jornada: null, matches: [], pool: null, canManage: true }),
    );
    getCurrentQuiniela.mockResolvedValueOnce(current());
    openQuiniela.mockResolvedValue({ id: "j1" });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /abrir quiniela/i }));
    await waitFor(() => expect(openQuiniela).toHaveBeenCalledWith("team-1"));
    expect(await screen.findByText("CD Los Olivos")).toBeInTheDocument();
  });

  it("con pronósticos cerrados deshabilita la selección y el guardado", async () => {
    const base = current();
    getCurrentQuiniela.mockResolvedValue(current({ jornada: { ...base.jornada!, picksClosed: true } }));
    renderPage();
    await screen.findByText("CD Los Olivos");
    expect(screen.getByText(/pronósticos cerrados/i)).toBeInTheDocument();
    const card = cardOf("CD Los Olivos");
    expect(within(card).getByRole("button", { name: /local/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /guardar boleto/i })).toBeDisabled();
  });

  it("guarda el boleto con los signos de los partidos válidos y el Pleno", async () => {
    getCurrentQuiniela.mockResolvedValue(current());
    saveQuinielaTicket.mockResolvedValue({
      id: "tk1",
      picks: [],
      plenoHome: 3,
      plenoAway: 1,
      paymentStatus: "Pending",
      paymentDeadlineUtc: null,
      hits: null,
      category: null,
      prize: null,
    });
    renderPage();
    await screen.findByText("CD Los Olivos");

    const save = screen.getByRole("button", { name: /guardar boleto/i });
    expect(save).toBeDisabled();

    fireEvent.click(within(cardOf("CD Los Olivos")).getByRole("button", { name: /local/i }));
    fireEvent.click(within(cardOf("Real Valdemar")).getByRole("button", { name: /empate/i }));
    fireEvent.click(within(cardOf("Unión Robledo")).getByRole("button", { name: /visitante/i }));
    fireEvent.click(within(screen.getByRole("group", { name: "Goles de Unión Robledo" })).getByRole("button", { name: "M" }));
    fireEvent.click(within(screen.getByRole("group", { name: "Goles de CD Fresnedillas" })).getByRole("button", { name: "1" }));

    expect(save).toBeEnabled();
    fireEvent.click(save);

    await waitFor(() =>
      expect(saveQuinielaTicket).toHaveBeenCalledWith("team-1", "j1", {
        picks: [
          { recordCode: "m1", sign: "1" },
          { recordCode: "m2", sign: "X" },
          { recordCode: "m8", sign: "2" },
        ],
        plenoHome: 3,
        plenoAway: 1,
      }),
    );
  });

  it("carga el boleto ya guardado y muestra su estado de pago", async () => {
    getCurrentQuiniela.mockResolvedValue(
      current({
        myTicket: {
          id: "tk1",
          picks: [{ recordCode: "m1", sign: "X" }],
          plenoHome: 0,
          plenoAway: 2,
          paymentStatus: "Pending",
          paymentDeadlineUtc: "2026-10-30T22:59:00Z",
          hits: null,
          category: null,
          prize: null,
        },
      }),
    );
    renderPage();
    await screen.findByText("CD Los Olivos");
    expect(within(cardOf("CD Los Olivos")).getByRole("button", { name: /empate/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Pendiente de pago")).toBeInTheDocument();
  });

  describe("eliminar mi boleto", () => {
    const savedTicket = (paymentStatus: "Pending" | "Paid" | "Expired") => ({
      id: "tk1",
      picks: [{ recordCode: "m1", sign: "X" as const }],
      plenoHome: 0,
      plenoAway: 2,
      paymentStatus,
      paymentDeadlineUtc: "2026-10-30T22:59:00Z",
      hits: null,
      category: null,
      prize: null,
    });

    it("elimina el boleto pendiente tras confirmar y vuelve a cargar la quiniela sin boleto", async () => {
      getCurrentQuiniela
        .mockResolvedValueOnce(current({ myTicket: savedTicket("Pending") }))
        .mockResolvedValueOnce(current());
      deleteMyQuinielaTicket.mockResolvedValue(undefined);
      renderPage();
      await screen.findByText("CD Los Olivos");

      fireEvent.click(screen.getByRole("button", { name: /eliminar mi boleto/i }));
      const dialog = await screen.findByRole("dialog");
      expect(deleteMyQuinielaTicket).not.toHaveBeenCalled();
      fireEvent.click(within(dialog).getByRole("button", { name: /^eliminar$/i }));

      await waitFor(() => expect(deleteMyQuinielaTicket).toHaveBeenCalledWith("team-1", "j1"));
      await waitFor(() => expect(getCurrentQuiniela).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      await waitFor(() => expect(screen.queryByRole("button", { name: /eliminar mi boleto/i })).not.toBeInTheDocument());
      expect(within(cardOf("CD Los Olivos")).getByRole("button", { name: /empate/i })).toHaveAttribute("aria-pressed", "false");
    });

    it("no elimina el boleto si se cancela la confirmación", async () => {
      getCurrentQuiniela.mockResolvedValue(current({ myTicket: savedTicket("Pending") }));
      renderPage();
      await screen.findByText("CD Los Olivos");

      fireEvent.click(screen.getByRole("button", { name: /eliminar mi boleto/i }));
      const dialog = await screen.findByRole("dialog");
      fireEvent.click(within(dialog).getByRole("button", { name: /cancelar/i }));

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(deleteMyQuinielaTicket).not.toHaveBeenCalled();
    });

    it("avisa con un snackbar si falla la eliminación", async () => {
      const listener = vi.fn();
      window.addEventListener("rffm.show_snackbar", listener);
      getCurrentQuiniela.mockResolvedValue(current({ myTicket: savedTicket("Pending") }));
      deleteMyQuinielaTicket.mockRejectedValue({ response: { data: { detail: "Solo puedes eliminar un boleto que aún no está pagado." } } });
      renderPage();
      await screen.findByText("CD Los Olivos");

      fireEvent.click(screen.getByRole("button", { name: /eliminar mi boleto/i }));
      const dialog = await screen.findByRole("dialog");
      fireEvent.click(within(dialog).getByRole("button", { name: /^eliminar$/i }));

      await waitFor(() => expect(listener).toHaveBeenCalled());
      const event = listener.mock.calls[0][0] as CustomEvent<{ message: string; severity: string }>;
      expect(event.detail.severity).toBe("error");
      window.removeEventListener("rffm.show_snackbar", listener);
    });

    it("también permite eliminar un boleto caducado sin pagar", async () => {
      getCurrentQuiniela.mockResolvedValue(current({ myTicket: savedTicket("Expired") }));
      renderPage();
      await screen.findByText("CD Los Olivos");
      expect(screen.getByRole("button", { name: /eliminar mi boleto/i })).toBeInTheDocument();
    });

    it("no ofrece eliminar un boleto ya pagado", async () => {
      getCurrentQuiniela.mockResolvedValue(current({ myTicket: savedTicket("Paid") }));
      renderPage();
      await screen.findByText("CD Los Olivos");
      expect(screen.queryByRole("button", { name: /eliminar mi boleto/i })).not.toBeInTheDocument();
    });

    it("no ofrece eliminar si todavía no hay boleto guardado", async () => {
      getCurrentQuiniela.mockResolvedValue(current());
      renderPage();
      await screen.findByText("CD Los Olivos");
      expect(screen.queryByRole("button", { name: /eliminar mi boleto/i })).not.toBeInTheDocument();
    });
  });

  it("muestra la bolsa de la jornada", async () => {
    getCurrentQuiniela.mockResolvedValue(current());
    renderPage();
    await screen.findByText("CD Los Olivos");
    expect(screen.getByText(/11,50\s€/)).toBeInTheDocument();
    expect(screen.getByText(/12 participantes/i)).toBeInTheDocument();
  });

  it("abre y cierra el popup de reglas con las 7 reglas y las 4 categorías", async () => {
    getCurrentQuiniela.mockResolvedValue(current());
    renderPage();
    await screen.findByText("CD Los Olivos");
    expect(screen.queryByRole("dialog", { name: /reglas de la quiniela/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /ver reglas/i }));
    const dialog = await screen.findByRole("dialog", { name: /reglas de la quiniela/i });
    expect(within(dialog).getAllByTestId("quiniela-rule")).toHaveLength(7);
    expect(within(dialog).getByText("Categoría Especial")).toBeInTheDocument();
    expect(within(dialog).getByText("1ª categoría")).toBeInTheDocument();
    expect(within(dialog).getByText("2ª categoría")).toBeInTheDocument();
    expect(within(dialog).getByText("3ª categoría")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: /entendido/i }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: /reglas de la quiniela/i })).not.toBeInTheDocument());
  });

  it("al abrir la página marca la quiniela como vista para quitar la etiqueta «Novedad»", async () => {
    localStorage.clear();
    localStorage.setItem("rffm_user", JSON.stringify({ id: "u1", username: "x" }));
    getCurrentQuiniela.mockResolvedValue(current());
    const now = new Date("2026-11-02T10:00:00Z");
    expect(isQuinielaNovelty("u1", "team-1", now)).toBe(true);

    renderPage();

    await screen.findByText("CD Los Olivos");
    expect(isQuinielaNovelty("u1", "team-1", now)).toBe(false);
  });
});
