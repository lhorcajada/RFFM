import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { QuinielaCurrent, QuinielaMatch, QuinielaTicket, QuinielaWallet } from "../../../services/quinielaService";
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

const useFeatureFlag = vi.fn();
vi.mock("../../../../../shared/hooks/useFeatureFlag", () => ({
  useFeatureFlag: (...args: unknown[]) => useFeatureFlag(...args),
}));

const getCurrentQuiniela = vi.fn();
const saveQuinielaTicket = vi.fn();
const openQuiniela = vi.fn();
const deleteMyQuinielaTicket = vi.fn();
const getMyQuinielaWallet = vi.fn();
const payQuinielaTicketWithWallet = vi.fn();
vi.mock("../../../services/quinielaService", () => ({
  getMyQuinielaWallet: (...args: unknown[]) => getMyQuinielaWallet(...args),
  payQuinielaTicketWithWallet: (...args: unknown[]) => payQuinielaTicketWithWallet(...args),
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
    myTickets: [],
    pool: { participants: 12, paidTickets: 8, collected: 8, prizePool: 11.5, possiblePrizePool: 13.5 },
    previous: null,
    canManage: false,
    ...overrides,
  };
}

function walletOf(balance: number): QuinielaWallet {
  return { userId: "u1", userName: "Yo", role: "Player", balance, totalMovements: 0, movements: [] };
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
    useFeatureFlag.mockReturnValue({ enabled: true, loading: false });
    getMyQuinielaWallet.mockResolvedValue(walletOf(0));
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

  it("ofrece un enlace al histórico de quinielas del equipo", async () => {
    getCurrentQuiniela.mockResolvedValue(current());
    renderPage();

    expect(await screen.findByRole("link", { name: /histórico/i })).toHaveAttribute(
      "href",
      "/coach/quiniela/historico?teamId=team-1",
    );
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
      number: 1,
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
      }, undefined),
    );
  });

  it("carga el boleto ya guardado y muestra su estado de pago", async () => {
    getCurrentQuiniela.mockResolvedValue(
      current({
        myTickets: [
          {
            id: "tk1",
            number: 1,
            picks: [{ recordCode: "m1", sign: "X" }],
            plenoHome: 0,
            plenoAway: 2,
            paymentStatus: "Pending",
            paymentDeadlineUtc: "2026-10-30T22:59:00Z",
            hits: null,
            category: null,
            prize: null,
          },
        ],
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
      number: 1,
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
        .mockResolvedValueOnce(current({ myTickets: [savedTicket("Pending")] }))
        .mockResolvedValueOnce(current());
      deleteMyQuinielaTicket.mockResolvedValue(undefined);
      renderPage();
      await screen.findByText("CD Los Olivos");

      fireEvent.click(screen.getByRole("button", { name: /eliminar mi boleto/i }));
      const dialog = await screen.findByRole("dialog");
      expect(deleteMyQuinielaTicket).not.toHaveBeenCalled();
      fireEvent.click(within(dialog).getByRole("button", { name: /^eliminar$/i }));

      await waitFor(() => expect(deleteMyQuinielaTicket).toHaveBeenCalledWith("team-1", "j1", "tk1"));
      await waitFor(() => expect(getCurrentQuiniela).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      await waitFor(() => expect(screen.queryByRole("button", { name: /eliminar mi boleto/i })).not.toBeInTheDocument());
      expect(within(cardOf("CD Los Olivos")).getByRole("button", { name: /empate/i })).toHaveAttribute("aria-pressed", "false");
    });

    it("no elimina el boleto si se cancela la confirmación", async () => {
      getCurrentQuiniela.mockResolvedValue(current({ myTickets: [savedTicket("Pending")] }));
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
      getCurrentQuiniela.mockResolvedValue(current({ myTickets: [savedTicket("Pending")] }));
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
      getCurrentQuiniela.mockResolvedValue(current({ myTickets: [savedTicket("Expired")] }));
      renderPage();
      await screen.findByText("CD Los Olivos");
      expect(screen.getByRole("button", { name: /eliminar mi boleto/i })).toBeInTheDocument();
    });

    it("no ofrece eliminar un boleto ya pagado", async () => {
      getCurrentQuiniela.mockResolvedValue(current({ myTickets: [savedTicket("Paid")] }));
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

  describe("varios boletos por usuario", () => {
    const ticketOf = (id: string, number: number, sign: "1" | "X" | "2", paymentStatus: "Pending" | "Paid" | "Expired" = "Pending") => ({
      id,
      number,
      picks: [{ recordCode: "m1", sign }],
      plenoHome: 0,
      plenoAway: 1,
      paymentStatus,
      paymentDeadlineUtc: "2026-10-30T22:59:00Z",
      hits: null,
      category: null,
      prize: null,
    });
    const twoTickets = () => [ticketOf("tk1", 1, "X"), ticketOf("tk2", 2, "2", "Paid")];
    const drawOfFirstMatch = () => within(cardOf("CD Los Olivos")).getByRole("button", { name: /empate/i });
    const awayOfFirstMatch = () => within(cardOf("CD Los Olivos")).getByRole("button", { name: /visitante/i });

    it("muestra un selector con cada boleto y uno para crear otro", async () => {
      getCurrentQuiniela.mockResolvedValue(current({ myTickets: twoTickets() }));
      renderPage();
      await screen.findByText("CD Los Olivos");

      const selector = screen.getByRole("group", { name: /mis boletos/i });
      expect(within(selector).getByRole("button", { name: "Boleto 1" })).toHaveAttribute("aria-pressed", "true");
      expect(within(selector).getByRole("button", { name: "Boleto 2" })).toHaveAttribute("aria-pressed", "false");
      expect(within(selector).getByRole("button", { name: /nuevo boleto/i })).toBeInTheDocument();
    });

    describe("con el feature flag QuinielaMultipleTickets apagado", () => {
      beforeEach(() => useFeatureFlag.mockReturnValue({ enabled: false, loading: false }));

      it("consulta el flag por su nombre", async () => {
        getCurrentQuiniela.mockResolvedValue(current());
        renderPage();
        await screen.findByText("CD Los Olivos");
        expect(useFeatureFlag).toHaveBeenCalledWith("QuinielaMultipleTickets");
      });

      it("con un solo boleto no muestra el selector ni «Nuevo boleto»", async () => {
        getCurrentQuiniela.mockResolvedValue(current({ myTickets: [ticketOf("tk1", 1, "X")] }));
        renderPage();
        await screen.findByText("CD Los Olivos");

        expect(screen.queryByRole("group", { name: /mis boletos/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /nuevo boleto/i })).not.toBeInTheDocument();
        expect(drawOfFirstMatch()).toHaveAttribute("aria-pressed", "true");
      });

      it("si ya hay varios boletos los sigue mostrando para revisarlos, pero no permite crear otro", async () => {
        getCurrentQuiniela.mockResolvedValue(current({ myTickets: twoTickets() }));
        renderPage();
        await screen.findByText("CD Los Olivos");

        const selector = screen.getByRole("group", { name: /mis boletos/i });
        expect(within(selector).getByRole("button", { name: "Boleto 2" })).toBeInTheDocument();
        expect(within(selector).queryByRole("button", { name: /nuevo boleto/i })).not.toBeInTheDocument();
      });

      it("permite guardar el primer boleto", async () => {
        getCurrentQuiniela.mockResolvedValue(current());
        saveQuinielaTicket.mockResolvedValue(ticketOf("tk1", 1, "1"));
        renderPage();
        await screen.findByText("CD Los Olivos");
        fireEvent.click(within(cardOf("CD Los Olivos")).getByRole("button", { name: /local/i }));
        fireEvent.click(within(cardOf("Real Valdemar")).getByRole("button", { name: /empate/i }));
        fireEvent.click(within(cardOf("Unión Robledo")).getByRole("button", { name: /visitante/i }));
        fireEvent.click(within(screen.getByRole("group", { name: "Goles de Unión Robledo" })).getByRole("button", { name: "0" }));
        fireEvent.click(within(screen.getByRole("group", { name: "Goles de CD Fresnedillas" })).getByRole("button", { name: "0" }));

        fireEvent.click(screen.getByRole("button", { name: /guardar boleto/i }));

        await waitFor(() => expect(saveQuinielaTicket).toHaveBeenCalledTimes(1));
      });
    });

    it("sin boletos no muestra el selector", async () => {
      getCurrentQuiniela.mockResolvedValue(current());
      renderPage();
      await screen.findByText("CD Los Olivos");
      expect(screen.queryByRole("group", { name: /mis boletos/i })).not.toBeInTheDocument();
    });

    it("al elegir otro boleto carga sus pronósticos y su estado de pago", async () => {
      getCurrentQuiniela.mockResolvedValue(current({ myTickets: twoTickets() }));
      renderPage();
      await screen.findByText("CD Los Olivos");
      expect(drawOfFirstMatch()).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByText("Pendiente de pago")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Boleto 2" }));

      expect(awayOfFirstMatch()).toHaveAttribute("aria-pressed", "true");
      expect(drawOfFirstMatch()).toHaveAttribute("aria-pressed", "false");
      expect(screen.getByText("Pagado")).toBeInTheDocument();
    });

    it("modifica el boleto seleccionado enviando su id", async () => {
      getCurrentQuiniela.mockResolvedValue(current({ myTickets: twoTickets() }));
      saveQuinielaTicket.mockResolvedValue(ticketOf("tk2", 2, "1", "Paid"));
      renderPage();
      await screen.findByText("CD Los Olivos");
      fireEvent.click(screen.getByRole("button", { name: "Boleto 2" }));
      fireEvent.click(within(cardOf("CD Los Olivos")).getByRole("button", { name: /local/i }));
      fireEvent.click(within(cardOf("Real Valdemar")).getByRole("button", { name: /empate/i }));
      fireEvent.click(within(cardOf("Unión Robledo")).getByRole("button", { name: /visitante/i }));
      fireEvent.click(within(screen.getByRole("group", { name: "Goles de Unión Robledo" })).getByRole("button", { name: "1" }));
      fireEvent.click(within(screen.getByRole("group", { name: "Goles de CD Fresnedillas" })).getByRole("button", { name: "2" }));

      fireEvent.click(screen.getByRole("button", { name: /guardar boleto/i }));

      await waitFor(() => expect(saveQuinielaTicket).toHaveBeenCalledTimes(1));
      expect(saveQuinielaTicket.mock.calls[0][3]).toBe("tk2");
    });

    it("crea un boleto nuevo con «Nuevo boleto» sin enviar id y lo deja seleccionado", async () => {
      getCurrentQuiniela.mockResolvedValue(current({ myTickets: [ticketOf("tk1", 1, "X")] }));
      saveQuinielaTicket.mockResolvedValue(ticketOf("tk3", 2, "1"));
      renderPage();
      await screen.findByText("CD Los Olivos");

      fireEvent.click(screen.getByRole("button", { name: /nuevo boleto/i }));
      expect(drawOfFirstMatch()).toHaveAttribute("aria-pressed", "false");
      expect(screen.getByRole("button", { name: /guardar boleto/i })).toBeDisabled();

      fireEvent.click(within(cardOf("CD Los Olivos")).getByRole("button", { name: /local/i }));
      fireEvent.click(within(cardOf("Real Valdemar")).getByRole("button", { name: /empate/i }));
      fireEvent.click(within(cardOf("Unión Robledo")).getByRole("button", { name: /visitante/i }));
      fireEvent.click(within(screen.getByRole("group", { name: "Goles de Unión Robledo" })).getByRole("button", { name: "0" }));
      fireEvent.click(within(screen.getByRole("group", { name: "Goles de CD Fresnedillas" })).getByRole("button", { name: "0" }));
      fireEvent.click(screen.getByRole("button", { name: /guardar boleto/i }));

      await waitFor(() => expect(saveQuinielaTicket).toHaveBeenCalledTimes(1));
      expect(saveQuinielaTicket.mock.calls[0][3]).toBeUndefined();
      expect(await screen.findByRole("button", { name: "Boleto 2" })).toHaveAttribute("aria-pressed", "true");
    });

    it("con los pronósticos cerrados permite revisar cada boleto pero no crear otro", async () => {
      const base = current({ myTickets: twoTickets() });
      getCurrentQuiniela.mockResolvedValue(current({ myTickets: twoTickets(), jornada: { ...base.jornada!, picksClosed: true } }));
      renderPage();
      await screen.findByText("CD Los Olivos");

      expect(screen.queryByRole("button", { name: /nuevo boleto/i })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Boleto 2" }));
      expect(awayOfFirstMatch()).toHaveAttribute("aria-pressed", "true");
      expect(awayOfFirstMatch()).toBeDisabled();
    });

    it("elimina solo el boleto seleccionado si está pendiente", async () => {
      getCurrentQuiniela
        .mockResolvedValueOnce(current({ myTickets: [ticketOf("tk1", 1, "X"), ticketOf("tk2", 2, "2")] }))
        .mockResolvedValueOnce(current({ myTickets: [ticketOf("tk1", 1, "X")] }));
      deleteMyQuinielaTicket.mockResolvedValue(undefined);
      renderPage();
      await screen.findByText("CD Los Olivos");
      fireEvent.click(screen.getByRole("button", { name: "Boleto 2" }));

      fireEvent.click(screen.getByRole("button", { name: /eliminar mi boleto/i }));
      const dialog = await screen.findByRole("dialog");
      fireEvent.click(within(dialog).getByRole("button", { name: /^eliminar$/i }));

      await waitFor(() => expect(deleteMyQuinielaTicket).toHaveBeenCalledWith("team-1", "j1", "tk2"));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      await waitFor(() => expect(screen.queryByRole("button", { name: "Boleto 2" })).not.toBeInTheDocument());
    });

    it("no ofrece eliminar el boleto seleccionado si está pagado", async () => {
      getCurrentQuiniela.mockResolvedValue(current({ myTickets: twoTickets() }));
      renderPage();
      await screen.findByText("CD Los Olivos");

      expect(screen.getByRole("button", { name: /eliminar mi boleto/i })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Boleto 2" }));
      expect(screen.queryByRole("button", { name: /eliminar mi boleto/i })).not.toBeInTheDocument();
    });
  });

  describe("monedero", () => {
    const walletTicket = (overrides: Partial<QuinielaTicket> = {}): QuinielaTicket => ({
      id: "tk1",
      number: 1,
      picks: [{ recordCode: "m1", sign: "X" }],
      plenoHome: 0,
      plenoAway: 2,
      paymentStatus: "Pending",
      paymentDeadlineUtc: "2026-10-30T22:59:00Z",
      hits: null,
      category: null,
      prize: null,
      ...overrides,
    });
    const captureSnackbars = () => {
      const listener = vi.fn();
      window.addEventListener("rffm.show_snackbar", listener);
      const messages = () =>
        listener.mock.calls.map((call) => (call[0] as CustomEvent<{ message: string; severity: string }>).detail);
      return { messages, stop: () => window.removeEventListener("rffm.show_snackbar", listener) };
    };
    const fillAndSave = async () => {
      fireEvent.click(within(cardOf("CD Los Olivos")).getByRole("button", { name: /local/i }));
      fireEvent.click(within(cardOf("Real Valdemar")).getByRole("button", { name: /empate/i }));
      fireEvent.click(within(cardOf("Unión Robledo")).getByRole("button", { name: /visitante/i }));
      fireEvent.click(within(screen.getByRole("group", { name: "Goles de Unión Robledo" })).getByRole("button", { name: "0" }));
      fireEvent.click(within(screen.getByRole("group", { name: "Goles de CD Fresnedillas" })).getByRole("button", { name: "0" }));
      fireEvent.click(screen.getByRole("button", { name: /guardar boleto/i }));
    };

    it("muestra el saldo del monedero y consulta el monedero propio del equipo", async () => {
      getCurrentQuiniela.mockResolvedValue(current());
      getMyQuinielaWallet.mockResolvedValue(walletOf(2.5));
      renderPage();
      await screen.findByText("CD Los Olivos");
      expect(await screen.findByText("Mi monedero")).toBeInTheDocument();
      expect(screen.getByText(/2,50\s€/)).toBeInTheDocument();
      expect(getMyQuinielaWallet).toHaveBeenCalledWith("team-1");
    });

    it("abre el historial del monedero con «Ver movimientos»", async () => {
      getCurrentQuiniela.mockResolvedValue(current());
      getMyQuinielaWallet.mockResolvedValue(walletOf(2.5));
      renderPage();
      fireEvent.click(await screen.findByRole("button", { name: /ver movimientos/i }));
      expect(await screen.findByText(/aún no hay movimientos/i)).toBeInTheDocument();
      expect(getMyQuinielaWallet).toHaveBeenCalledWith("team-1", { limit: 25, offset: 0 });
    });

    it("avisa con el importe cobrado y el saldo al guardar un boleto con cobro", async () => {
      const snackbars = captureSnackbars();
      getCurrentQuiniela.mockResolvedValue(current());
      saveQuinielaTicket.mockResolvedValue(walletTicket({ paymentStatus: "Paid", paymentMethod: "Wallet", walletCharge: { amount: 1, balanceAfter: 2 } }));
      renderPage();
      await screen.findByText("CD Los Olivos");
      await fillAndSave();

      await waitFor(() => expect(snackbars.messages().some((m) => /Se han cobrado 1,00\s€ de tu monedero\. Saldo: 2,00\s€/.test(m.message))).toBe(true));
      snackbars.stop();
    });

    it("despacha rffm.quiniela_wallet_updated al guardar un boleto con cobro", async () => {
      const listener = vi.fn();
      window.addEventListener("rffm.quiniela_wallet_updated", listener);
      getCurrentQuiniela.mockResolvedValue(current());
      saveQuinielaTicket.mockResolvedValue(
        walletTicket({ paymentStatus: "Paid", paymentMethod: "Wallet", walletCharge: { amount: 1, balanceAfter: 2 } }),
      );
      renderPage();
      await screen.findByText("CD Los Olivos");
      await fillAndSave();

      await waitFor(() => expect(listener).toHaveBeenCalledTimes(1));
      window.removeEventListener("rffm.quiniela_wallet_updated", listener);
    });

    it("no avisa del cobro si el guardado no cobró nada", async () => {
      const snackbars = captureSnackbars();
      getCurrentQuiniela.mockResolvedValue(current());
      saveQuinielaTicket.mockResolvedValue(walletTicket());
      renderPage();
      await screen.findByText("CD Los Olivos");
      await fillAndSave();

      await waitFor(() => expect(snackbars.messages().length).toBeGreaterThan(0));
      expect(snackbars.messages().some((m) => /monedero/i.test(m.message))).toBe(false);
      snackbars.stop();
    });

    it("muestra «Pagado con monedero» en un boleto pagado con el monedero", async () => {
      getCurrentQuiniela.mockResolvedValue(current({ myTickets: [walletTicket({ paymentStatus: "Paid", paymentMethod: "Wallet" })] }));
      renderPage();
      await screen.findByText("CD Los Olivos");
      expect(screen.getByText("Pagado con monedero")).toBeInTheDocument();
    });

    describe("pagar con monedero", () => {
      it("se ofrece en un boleto pendiente con pronósticos abiertos", async () => {
        getCurrentQuiniela.mockResolvedValue(current({ myTickets: [walletTicket()] }));
        getMyQuinielaWallet.mockResolvedValue(walletOf(3));
        renderPage();
        await screen.findByText("CD Los Olivos");
        expect(await screen.findByRole("button", { name: /pagar con monedero/i })).toBeEnabled();
      });

      it.each([
        ["pagado", walletTicket({ paymentStatus: "Paid", paymentMethod: "Cash" })],
        ["expirado", walletTicket({ paymentStatus: "Expired" })],
      ])("no se ofrece en un boleto %s", async (_label, ticket) => {
        getCurrentQuiniela.mockResolvedValue(current({ myTickets: [ticket] }));
        getMyQuinielaWallet.mockResolvedValue(walletOf(3));
        renderPage();
        await screen.findByText("CD Los Olivos");
        await screen.findByText("Mi monedero");
        expect(screen.queryByRole("button", { name: /pagar con monedero/i })).not.toBeInTheDocument();
      });

      it("no se ofrece con los pronósticos cerrados", async () => {
        const base = current();
        getCurrentQuiniela.mockResolvedValue(
          current({ myTickets: [walletTicket()], jornada: { ...base.jornada!, picksClosed: true } }),
        );
        getMyQuinielaWallet.mockResolvedValue(walletOf(3));
        renderPage();
        await screen.findByText("CD Los Olivos");
        await screen.findByText("Mi monedero");
        expect(screen.queryByRole("button", { name: /pagar con monedero/i })).not.toBeInTheDocument();
      });

      it("queda deshabilitado con el motivo si el saldo no alcanza el precio", async () => {
        getCurrentQuiniela.mockResolvedValue(current({ myTickets: [walletTicket()] }));
        getMyQuinielaWallet.mockResolvedValue(walletOf(0.5));
        renderPage();
        await screen.findByText("CD Los Olivos");
        const button = await screen.findByRole("button", { name: /pagar con monedero/i });
        expect(button).toBeDisabled();
        expect(screen.getByText(/saldo insuficiente/i)).toBeInTheDocument();
      });

      it("al pagar avisa del cobro, marca el boleto pagado y refresca el saldo", async () => {
        const snackbars = captureSnackbars();
        getCurrentQuiniela.mockResolvedValue(current({ myTickets: [walletTicket()] }));
        getMyQuinielaWallet.mockResolvedValueOnce(walletOf(3)).mockResolvedValue(walletOf(2));
        payQuinielaTicketWithWallet.mockResolvedValue(
          walletTicket({ paymentStatus: "Paid", paymentMethod: "Wallet", walletCharge: { amount: 1, balanceAfter: 2 } }),
        );
        renderPage();
        await screen.findByText("CD Los Olivos");
        fireEvent.click(await screen.findByRole("button", { name: /pagar con monedero/i }));

        await waitFor(() => expect(payQuinielaTicketWithWallet).toHaveBeenCalledWith("team-1", "j1", "tk1"));
        expect(await screen.findByText("Pagado con monedero")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /pagar con monedero/i })).not.toBeInTheDocument();
        expect(snackbars.messages().some((m) => m.severity === "success" && /Se han cobrado 1,00\s€/.test(m.message))).toBe(true);
        await waitFor(() => expect(getMyQuinielaWallet).toHaveBeenCalledTimes(2));
        snackbars.stop();
      });

      it("despacha rffm.quiniela_wallet_updated tras pagar con el monedero", async () => {
        const listener = vi.fn();
        window.addEventListener("rffm.quiniela_wallet_updated", listener);
        getCurrentQuiniela.mockResolvedValue(current({ myTickets: [walletTicket()] }));
        getMyQuinielaWallet.mockResolvedValue(walletOf(3));
        payQuinielaTicketWithWallet.mockResolvedValue(
          walletTicket({ paymentStatus: "Paid", paymentMethod: "Wallet", walletCharge: { amount: 1, balanceAfter: 2 } }),
        );
        renderPage();
        await screen.findByText("CD Los Olivos");
        fireEvent.click(await screen.findByRole("button", { name: /pagar con monedero/i }));

        await waitFor(() => expect(listener).toHaveBeenCalledTimes(1));
        window.removeEventListener("rffm.quiniela_wallet_updated", listener);
      });

      it("ante un 409 de saldo insuficiente avisa con un error y refresca el saldo", async () => {
        const snackbars = captureSnackbars();
        getCurrentQuiniela.mockResolvedValue(current({ myTickets: [walletTicket()] }));
        getMyQuinielaWallet.mockResolvedValue(walletOf(3));
        payQuinielaTicketWithWallet.mockRejectedValue({
          response: { status: 409, data: { detail: "Saldo insuficiente en el monedero.", code: "QuinielaWalletInsufficientBalance" } },
        });
        renderPage();
        await screen.findByText("CD Los Olivos");
        fireEvent.click(await screen.findByRole("button", { name: /pagar con monedero/i }));

        await waitFor(() =>
          expect(snackbars.messages()).toContainEqual({ message: "Saldo insuficiente en el monedero.", severity: "error" }),
        );
        await waitFor(() => expect(getMyQuinielaWallet).toHaveBeenCalledTimes(2));
        expect(screen.getByText("Pendiente de pago")).toBeInTheDocument();
        snackbars.stop();
      });
    });

    describe("eliminar un boleto pagado", () => {
      it("se ofrece en un boleto pagado con monedero y la confirmación avisa del reembolso", async () => {
        getCurrentQuiniela.mockResolvedValue(current({ myTickets: [walletTicket({ paymentStatus: "Paid", paymentMethod: "Wallet" })] }));
        renderPage();
        await screen.findByText("CD Los Olivos");

        fireEvent.click(screen.getByRole("button", { name: /eliminar mi boleto/i }));
        const dialog = await screen.findByRole("dialog");
        expect(within(dialog).getByText(/reembols/i)).toBeInTheDocument();
        expect(within(dialog).getByText(/monedero/i)).toBeInTheDocument();
      });

      it.each(["Cash", "Bizum"] as const)("no se ofrece en un boleto pagado con %s y se indica que lo pida al entrenador", async (method) => {
        getCurrentQuiniela.mockResolvedValue(current({ myTickets: [walletTicket({ paymentStatus: "Paid", paymentMethod: method })] }));
        renderPage();
        await screen.findByText("CD Los Olivos");
        expect(screen.queryByRole("button", { name: /eliminar mi boleto/i })).not.toBeInTheDocument();
        expect(screen.getByText(/pídeselo al entrenador/i)).toBeInTheDocument();
      });

      it("no se ofrece en un boleto pagado con monedero si los pronósticos están cerrados", async () => {
        const base = current();
        getCurrentQuiniela.mockResolvedValue(
          current({
            myTickets: [walletTicket({ paymentStatus: "Paid", paymentMethod: "Wallet" })],
            jornada: { ...base.jornada!, picksClosed: true },
          }),
        );
        renderPage();
        await screen.findByText("CD Los Olivos");
        expect(screen.queryByRole("button", { name: /eliminar mi boleto/i })).not.toBeInTheDocument();
      });
    });

    it("el entrenador ve el acceso a los monederos", async () => {
      getCurrentQuiniela.mockResolvedValue(current({ canManage: true }));
      renderPage();
      expect(await screen.findByRole("button", { name: /monederos/i })).toBeInTheDocument();
    });

    it("el participante no ve el acceso a los monederos", async () => {
      getCurrentQuiniela.mockResolvedValue(current({ canManage: false }));
      renderPage();
      await screen.findByText("CD Los Olivos");
      expect(screen.queryByRole("button", { name: /monederos/i })).not.toBeInTheDocument();
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
