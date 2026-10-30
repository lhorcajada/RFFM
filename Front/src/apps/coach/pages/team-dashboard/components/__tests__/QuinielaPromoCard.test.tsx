import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COACH_FEATURE_ROUTES } from "../../../../constants/featureRoutes";
import type { QuinielaCurrent, QuinielaPrevious, QuinielaTicket } from "../../../../services/quinielaService";

const mockPermissions = vi.fn();
vi.mock("../../../../../../shared/hooks/usePermissions", () => ({
  usePermissions: () => mockPermissions(),
}));

const getCurrentQuiniela = vi.fn();
vi.mock("../../../../services/quinielaService", () => ({
  getCurrentQuiniela: (...args: unknown[]) => getCurrentQuiniela(...args),
}));

import QuinielaPromoCard from "../QuinielaPromoCard";
import { markQuinielaSeen } from "../../utils/quinielaNovelty";

function ticket(overrides: Partial<QuinielaTicket> = {}): QuinielaTicket {
  return {
    id: "tk1",
    number: 1,
    picks: [],
    plenoHome: 1,
    plenoAway: 1,
    paymentStatus: "Pending",
    paymentDeadlineUtc: "2026-10-30T22:59:00Z",
    hits: null,
    category: null,
    prize: null,
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
    matches: [],
    myTickets: [],
    pool: { participants: 12, paidTickets: 8, collected: 8, prizePool: 11.5, possiblePrizePool: 13.5 },
    previous: null,
    canManage: false,
    ...overrides,
  };
}

function renderCard() {
  return render(
    <MemoryRouter>
      <QuinielaPromoCard teamId="team-1" />
    </MemoryRouter>,
  );
}

describe("QuinielaPromoCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-02T10:00:00Z"));
    mockPermissions.mockReturnValue({
      loading: false,
      hasFeatureAccess: (route: string) => route === COACH_FEATURE_ROUTES.Quiniela,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("muestra la bolsa posible con los pendientes de pago", async () => {
    getCurrentQuiniela.mockResolvedValue(current());
    renderCard();

    const possible = (await screen.findByText("Bolsa posible")).parentElement as HTMLElement;
    expect(possible).toHaveTextContent(/13,50\s€/);
  });

  describe("ganadores de la jornada cerrada", () => {
    const previous = (winners: QuinielaPrevious["winners"]): QuinielaPrevious => ({
      jornadaId: "j0",
      roundNumber: 6,
      settledAt: "2026-10-26T10:00:00Z",
      carryOut: 2,
      myHits: null,
      myCategory: null,
      myPrize: null,
      winners,
    });
    const closed = (winners: QuinielaPrevious["winners"]) =>
      current({ isOpen: false, jornada: null, matches: [], pool: null, previous: previous(winners) });

    it("muestra una tarjeta con los ganadores, su categoría y su premio", async () => {
      getCurrentQuiniela.mockResolvedValue(
        closed([
          { userName: "Carla Ruiz", category: "Special", hits: 14, prize: 6.5, ticketNumber: 1 },
          { userName: "Lucas Medina", category: "Second", hits: 12, prize: 2, ticketNumber: 2 },
        ]),
      );
      renderCard();

      const card = await screen.findByRole("region", { name: /ganadores de la quiniela/i });
      expect(card).toHaveTextContent("Jornada 6");
      expect(card).toHaveTextContent("Carla Ruiz");
      expect(card).toHaveTextContent("Categoría Especial");
      expect(card).toHaveTextContent(/6,50\s€/);
      expect(card).toHaveTextContent("Lucas Medina · Boleto 2");
    });

    it("sin acertantes avisa de que el bote pasa a la siguiente jornada", async () => {
      getCurrentQuiniela.mockResolvedValue(closed([]));
      renderCard();

      const card = await screen.findByRole("region", { name: /ganadores de la quiniela/i });
      expect(card).toHaveTextContent(/sin acertantes/i);
      expect(card).toHaveTextContent(/2,00\s€/);
    });

    const winner = { userName: "Carla Ruiz", category: "Special" as const, hits: 14, prize: 6.5, ticketNumber: 1 };

    it("se muestra junto a la quiniela nueva mientras no cierra su plazo", async () => {
      getCurrentQuiniela.mockResolvedValue(current({ previous: previous([winner]) }));
      renderCard();

      expect(await screen.findByRole("region", { name: /ganadores de la quiniela/i })).toHaveTextContent("Carla Ruiz");
      expect(screen.getByText("Quiniela del equipo")).toBeInTheDocument();
    });

    it("se oculta cuando el plazo de la jornada nueva ya ha cerrado", async () => {
      const data = current({ previous: previous([winner]) });
      data.jornada = { ...data.jornada!, picksClosed: true };
      getCurrentQuiniela.mockResolvedValue(data);
      renderCard();

      await screen.findByText("Quiniela del equipo");
      expect(screen.queryByRole("region", { name: /ganadores de la quiniela/i })).not.toBeInTheDocument();
    });

    it("destaca el premio propio del usuario", async () => {
      const mine = { ...winner, isMine: true };
      getCurrentQuiniela.mockResolvedValue(
        current({
          isOpen: false,
          jornada: null,
          previous: { ...previous([mine]), myHits: 14, myCategory: "Special", myPrize: 6.5 },
        }),
      );
      renderCard();

      const card = await screen.findByRole("region", { name: /ganadores de la quiniela/i });
      expect(card).toHaveTextContent(/tu premio/i);
      expect(card).toHaveTextContent(/6,50\s€/);
    });

    it("enlaza al histórico de quinielas", async () => {
      getCurrentQuiniela.mockResolvedValue(closed([winner]));
      renderCard();

      const card = await screen.findByRole("region", { name: /ganadores de la quiniela/i });
      expect(within(card).getByRole("link", { name: /ver histórico/i })).toHaveAttribute(
        "href",
        "/coach/quiniela/historico?teamId=team-1",
      );
    });
  });

  describe("enlace permanente al histórico", () => {
    const settled: QuinielaPrevious = {
      jornadaId: "j0",
      roundNumber: 6,
      settledAt: "2026-10-26T10:00:00Z",
      carryOut: 0,
      myHits: null,
      myCategory: null,
      myPrize: null,
      winners: [],
    };

    it("con la quiniela abierta y jornadas liquidadas ofrece «Ver resultados anteriores» aunque la tarjeta de resultados ya no se muestre", async () => {
      const data = current({ previous: settled });
      data.jornada = { ...data.jornada!, picksClosed: true };
      getCurrentQuiniela.mockResolvedValue(data);
      renderCard();

      expect(await screen.findByRole("link", { name: /ver resultados anteriores/i })).toHaveAttribute(
        "href",
        "/coach/quiniela/historico?teamId=team-1",
      );
    });

    it("sin jornadas liquidadas no ofrece el enlace", async () => {
      getCurrentQuiniela.mockResolvedValue(current({ previous: null }));
      renderCard();

      await screen.findByText("Quiniela del equipo");
      expect(screen.queryByRole("link", { name: /ver resultados anteriores/i })).not.toBeInTheDocument();
    });
  });

  it("muestra el bote acumulado junto a la bolsa", async () => {
    getCurrentQuiniela.mockResolvedValue(current());
    renderCard();

    const bote = (await screen.findByText("Bote")).parentElement as HTMLElement;
    expect(bote).toHaveTextContent(/3,50\s€/);
  });

  it("se actualiza sola al volver a la pestaña cuando entra un boleto nuevo", async () => {
    getCurrentQuiniela
      .mockResolvedValueOnce(current())
      .mockResolvedValue(current({ pool: { participants: 13, paidTickets: 9, collected: 9, prizePool: 12.5, possiblePrizePool: 14.5 } }));
    renderCard();
    await screen.findByText(/11,50\s€/);

    document.dispatchEvent(new Event("visibilitychange"));

    expect(await screen.findByText(/12,50\s€/)).toBeInTheDocument();
    expect(getCurrentQuiniela).toHaveBeenCalledTimes(2);
  });

  it("conserva los datos si falla una actualización automática", async () => {
    getCurrentQuiniela.mockResolvedValueOnce(current()).mockRejectedValue(new Error("boom"));
    renderCard();
    await screen.findByText(/11,50\s€/);

    document.dispatchEvent(new Event("visibilitychange"));

    await waitFor(() => expect(getCurrentQuiniela).toHaveBeenCalledTimes(2));
    expect(screen.getByText(/11,50\s€/)).toBeInTheDocument();
  });

  it("sin boleto muestra «Rellenar mi boleto» hacia la quiniela del equipo, con la bolsa y el cierre", async () => {
    getCurrentQuiniela.mockResolvedValue(current());
    renderCard();

    const cta = await screen.findByRole("link", { name: /Rellenar mi boleto/ });
    expect(cta).toHaveAttribute("href", "/coach/quiniela?teamId=team-1");
    expect(screen.getByText("Quiniela del equipo")).toBeInTheDocument();
    expect(screen.getByText("Aún no has rellenado tu boleto")).toBeInTheDocument();
    expect(screen.getByText("11,50 €")).toBeInTheDocument();
    expect(screen.getByText(/Sáb 31 oct/)).toBeInTheDocument();
  });

  it("con el boleto pendiente de pago muestra el plazo del viernes y «Ver mi boleto»", async () => {
    getCurrentQuiniela.mockResolvedValue(current({ myTickets: [ticket()] }));
    renderCard();

    expect(await screen.findByText(/Pendiente de pago · hasta el viernes 23:59/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver mi boleto/ })).toBeInTheDocument();
  });

  it("con el boleto pagado muestra «Boleto pagado»", async () => {
    getCurrentQuiniela.mockResolvedValue(current({ myTickets: [ticket({ paymentStatus: "Paid" })] }));
    renderCard();

    expect(await screen.findByText(/Boleto pagado/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver mi boleto/ })).toBeInTheDocument();
  });

  it("con varios boletos y alguno pendiente avisa del pago y muestra «Ver mis boletos»", async () => {
    getCurrentQuiniela.mockResolvedValue(
      current({ myTickets: [ticket({ paymentStatus: "Paid" }), ticket({ id: "tk2", number: 2, paymentStatus: "Pending" })] }),
    );
    renderCard();

    expect(await screen.findByText(/Pendiente de pago · hasta el viernes 23:59/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver mis boletos/ })).toBeInTheDocument();
  });

  it("con varios boletos todos pagados muestra «Boleto pagado»", async () => {
    getCurrentQuiniela.mockResolvedValue(
      current({ myTickets: [ticket({ paymentStatus: "Paid" }), ticket({ id: "tk2", number: 2, paymentStatus: "Paid" })] }),
    );
    renderCard();

    expect(await screen.findByText(/Boleto pagado/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver mis boletos/ })).toBeInTheDocument();
  });

  describe("con los pronósticos cerrados", () => {
    const closedCurrent = (overrides: Partial<QuinielaCurrent> = {}) => {
      const data = current(overrides);
      data.jornada = { ...data.jornada!, picksClosed: true };
      return data;
    };

    it("con boleto muestra «Pronósticos cerrados», la hora a la que cerró y «Ver mi boleto»", async () => {
      getCurrentQuiniela.mockResolvedValue(closedCurrent({ myTickets: [ticket({ paymentStatus: "Paid" })] }));
      renderCard();

      expect(await screen.findByText("Pronósticos cerrados")).toBeInTheDocument();
      expect(screen.getByText("Cerró")).toBeInTheDocument();
      expect(screen.getByText(/Sáb 31 oct/)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /Ver mi boleto/ })).toBeInTheDocument();
    });

    it("sin boleto avisa de que no participa en la jornada", async () => {
      getCurrentQuiniela.mockResolvedValue(closedCurrent());
      renderCard();

      expect(await screen.findByText(/no participas en esta jornada/i)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /Ver quiniela/ })).toBeInTheDocument();
    });
  });

  it("muestra la etiqueta «Novedad» dentro de los 14 días y sin haberla abierto", async () => {
    getCurrentQuiniela.mockResolvedValue(current());
    renderCard();

    expect(await screen.findByText("Novedad")).toBeInTheDocument();
  });

  it("oculta «Novedad» si el usuario ya abrió la quiniela", async () => {
    localStorage.setItem("rffm_user", JSON.stringify({ id: "u1", username: "x" }));
    markQuinielaSeen("u1", "team-1");
    getCurrentQuiniela.mockResolvedValue(current());
    renderCard();

    await screen.findByRole("link", { name: /Rellenar mi boleto/ });
    expect(screen.queryByText("Novedad")).not.toBeInTheDocument();
  });

  it("oculta «Novedad» pasados 14 días desde el lanzamiento", async () => {
    vi.setSystemTime(new Date("2026-11-20T10:00:00Z"));
    getCurrentQuiniela.mockResolvedValue(current());
    renderCard();

    await screen.findByRole("link", { name: /Rellenar mi boleto/ });
    expect(screen.queryByText("Novedad")).not.toBeInTheDocument();
  });

  it("sigue mostrando la tarjeta aunque el almacenamiento falle", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    getCurrentQuiniela.mockResolvedValue(current());
    renderCard();

    expect(await screen.findByRole("link", { name: /Rellenar mi boleto/ })).toBeInTheDocument();
    expect(screen.getByText("Novedad")).toBeInTheDocument();
  });

  it("no muestra nada a un jugador cuando no hay quiniela abierta", async () => {
    getCurrentQuiniela.mockResolvedValue(current({ isOpen: false, jornada: null, canManage: false }));
    const { container } = renderCard();

    await waitFor(() => expect(getCurrentQuiniela).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("al entrenador sin quiniela abierta le ofrece «Abrir quiniela» hacia la página", async () => {
    getCurrentQuiniela.mockResolvedValue(current({ isOpen: false, jornada: null, canManage: true }));
    renderCard();

    expect(await screen.findByRole("link", { name: "Abrir quiniela" })).toHaveAttribute(
      "href",
      "/coach/quiniela?teamId=team-1",
    );
    expect(screen.queryByText("Quiniela del equipo")).not.toBeInTheDocument();
  });

  it("no pide la quiniela ni muestra nada sin acceso a la funcionalidad", () => {
    mockPermissions.mockReturnValue({ loading: false, hasFeatureAccess: () => false });
    const { container } = renderCard();

    expect(container).toBeEmptyDOMElement();
    expect(getCurrentQuiniela).not.toHaveBeenCalled();
  });

  it("silencia los errores de red sin romper la home", async () => {
    getCurrentQuiniela.mockRejectedValue(new Error("network"));
    const { container } = renderCard();

    await waitFor(() => expect(getCurrentQuiniela).toHaveBeenCalledTimes(1));
    expect(container).toBeEmptyDOMElement();
  });

  it("hace una sola petición de la quiniela actual", async () => {
    getCurrentQuiniela.mockResolvedValue(current());
    renderCard();

    await screen.findByRole("link", { name: /Rellenar mi boleto/ });
    expect(getCurrentQuiniela).toHaveBeenCalledTimes(1);
    expect(getCurrentQuiniela).toHaveBeenCalledWith("team-1");
  });

  it("«Ver reglas» abre el popup de reglas", async () => {
    getCurrentQuiniela.mockResolvedValue(current());
    const user = userEvent.setup({ advanceTimers: () => undefined });
    renderCard();

    await user.click(await screen.findByRole("button", { name: /Ver reglas/ }));

    expect(await screen.findByText("Reglas de la quiniela")).toBeInTheDocument();
  });
});
