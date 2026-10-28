import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COACH_FEATURE_ROUTES } from "../../../../constants/featureRoutes";
import type { QuinielaCurrent, QuinielaTicket } from "../../../../services/quinielaService";

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
    myTicket: null,
    pool: { participants: 12, paidTickets: 8, collected: 8, prizePool: 11.5 },
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
    getCurrentQuiniela.mockResolvedValue(current({ myTicket: ticket() }));
    renderCard();

    expect(await screen.findByText(/Pendiente de pago · hasta el viernes 23:59/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver mi boleto/ })).toBeInTheDocument();
  });

  it("con el boleto pagado muestra «Boleto pagado»", async () => {
    getCurrentQuiniela.mockResolvedValue(current({ myTicket: ticket({ paymentStatus: "Paid" }) }));
    renderCard();

    expect(await screen.findByText(/Boleto pagado/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver mi boleto/ })).toBeInTheDocument();
  });

  it("con los pronósticos cerrados muestra «Ver resultados»", async () => {
    const data = current();
    data.jornada = { ...data.jornada!, picksClosed: true };
    getCurrentQuiniela.mockResolvedValue(data);
    renderCard();

    expect(await screen.findByRole("link", { name: /Ver resultados/ })).toBeInTheDocument();
    expect(screen.getByText("Pronósticos cerrados")).toBeInTheDocument();
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
