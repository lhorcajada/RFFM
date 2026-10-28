import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  QuinielaCurrent,
  QuinielaPaymentTicket,
  QuinielaPayments,
} from "../../../services/quinielaService";
import { UserProvider } from "../../../../../shared/context/UserContext";

vi.mock("../../../services/authService", () => ({
  coachAuthService: {
    getRoles: () => ["Coach"],
    hasRole: (role: string) => role === "Coach",
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
const getQuinielaPayments = vi.fn();
const setQuinielaTicketPayment = vi.fn();
const settleQuiniela = vi.fn();
vi.mock("../../../services/quinielaService", () => ({
  getCurrentQuiniela: (...args: unknown[]) => getCurrentQuiniela(...args),
  getQuinielaPayments: (...args: unknown[]) => getQuinielaPayments(...args),
  setQuinielaTicketPayment: (...args: unknown[]) => setQuinielaTicketPayment(...args),
  settleQuiniela: (...args: unknown[]) => settleQuiniela(...args),
}));

import QuinielaPool from "../QuinielaPool";

function ticket(overrides: Partial<QuinielaPaymentTicket>): QuinielaPaymentTicket {
  return {
    id: "t1",
    userId: "u1",
    userName: "Carla Ruiz",
    role: "FamilyPlayer",
    paymentStatus: "Paid",
    paymentMethod: "Cash",
    paidAt: "2026-10-28T17:20:00Z",
    hits: null,
    category: null,
    prize: null,
    ...overrides,
  };
}

function payments(overrides: Partial<QuinielaPayments> = {}): QuinielaPayments {
  return {
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
    tickets: [
      ticket({ id: "t1", userName: "Carla Ruiz" }),
      ticket({ id: "t2", userId: "u2", userName: "Lucas Medina", role: "Player", paymentMethod: "Bizum" }),
      ticket({ id: "t3", userId: "u3", userName: "Pablo Vega", role: "Player", paymentStatus: "Pending", paymentMethod: null, paidAt: null }),
    ],
    totals: { collected: 2, pending: 1, prizePool: 4.6, fundAmount: 0.9, carryIn: 3.5, carryOut: null, prizes: 0 },
    movements: [{ id: "mv1", amount: 1, occurredAt: "2026-10-28T17:20:00Z", description: "Cobro · Carla Ruiz" }],
    ...overrides,
  };
}

function currentFor(canManage: boolean): QuinielaCurrent {
  return {
    isOpen: true,
    jornada: payments().jornada,
    matches: [],
    myTicket: null,
    pool: null,
    previous: null,
    canManage,
  };
}

function renderPage() {
  return render(
    <UserProvider>
      <MemoryRouter initialEntries={["/coach/quiniela/bolsa?teamId=team-1"]}>
        <Routes>
          <Route path="/coach/quiniela/bolsa" element={<QuinielaPool />} />
          <Route path="/coach/quiniela" element={<div>Pagina de participante</div>} />
        </Routes>
      </MemoryRouter>
    </UserProvider>,
  );
}

function stat(name: string): HTMLElement {
  return screen.getByRole("group", { name });
}

describe("QuinielaPool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentQuiniela.mockResolvedValue(currentFor(true));
    getQuinielaPayments.mockResolvedValue(payments());
  });

  it("muestra los totales de cobrado, pendiente, premios y fondo", async () => {
    renderPage();
    await screen.findByText("Carla Ruiz");
    expect(within(stat("Cobrado")).getByText("2,00 €")).toBeInTheDocument();
    expect(within(stat("Pendiente de cobro")).getByText("1,00 €")).toBeInTheDocument();
    expect(within(stat("Premios de la jornada")).getByText("4,60 €")).toBeInTheDocument();
    expect(within(stat("Fondo del equipo")).getByText("0,90 €")).toBeInTheDocument();
  });

  it("muestra una tarjeta por boleto con su estado", async () => {
    renderPage();
    await screen.findByText("Carla Ruiz");
    expect(screen.getByText("Lucas Medina")).toBeInTheDocument();
    expect(screen.getByText("Pablo Vega")).toBeInTheDocument();
    expect(screen.getAllByText("Pagado")).toHaveLength(2);
  });

  it("filtra por pendientes y por pagados", async () => {
    renderPage();
    await screen.findByText("Carla Ruiz");

    fireEvent.click(screen.getByRole("button", { name: /pendientes \(1\)/i }));
    expect(screen.queryByText("Carla Ruiz")).not.toBeInTheDocument();
    expect(screen.getByText("Pablo Vega")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /pagados \(2\)/i }));
    expect(screen.getByText("Carla Ruiz")).toBeInTheDocument();
    expect(screen.queryByText("Pablo Vega")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /todos \(3\)/i }));
    expect(screen.getByText("Pablo Vega")).toBeInTheDocument();
  });

  it("marca un boleto como pagado en efectivo y refresca los totales", async () => {
    const updated = payments({
      tickets: payments().tickets.map((t) => (t.id === "t3" ? { ...t, paymentStatus: "Paid" as const, paymentMethod: "Cash" as const } : t)),
      totals: { collected: 3, pending: 0, prizePool: 5.15, fundAmount: 1.35, carryIn: 3.5, carryOut: null, prizes: 0 },
    });
    setQuinielaTicketPayment.mockResolvedValue(updated.tickets[2]);
    getQuinielaPayments.mockResolvedValueOnce(payments()).mockResolvedValueOnce(updated);
    renderPage();
    await screen.findByText("Pablo Vega");

    fireEvent.click(screen.getByRole("button", { name: /pagado en efectivo/i }));

    await waitFor(() =>
      expect(setQuinielaTicketPayment).toHaveBeenCalledWith("team-1", "j1", "t3", { paid: true, method: "Cash" }),
    );
    await waitFor(() => expect(within(stat("Cobrado")).getByText("3,00 €")).toBeInTheDocument());
    expect(getQuinielaPayments).toHaveBeenCalledTimes(2);
  });

  it("marca un boleto como pagado por Bizum", async () => {
    setQuinielaTicketPayment.mockResolvedValue(payments().tickets[2]);
    renderPage();
    await screen.findByText("Pablo Vega");

    fireEvent.click(screen.getByRole("button", { name: /pagado por bizum/i }));

    await waitFor(() =>
      expect(setQuinielaTicketPayment).toHaveBeenCalledWith("team-1", "j1", "t3", { paid: true, method: "Bizum" }),
    );
  });

  it("deshace un pago y refresca los totales", async () => {
    setQuinielaTicketPayment.mockResolvedValue(payments().tickets[0]);
    renderPage();
    await screen.findByText("Carla Ruiz");

    fireEvent.click(screen.getAllByRole("button", { name: /deshacer/i })[0]);

    await waitFor(() =>
      expect(setQuinielaTicketPayment).toHaveBeenCalledWith("team-1", "j1", "t1", { paid: false }),
    );
    await waitFor(() => expect(getQuinielaPayments).toHaveBeenCalledTimes(2));
  });

  it("avisa con un snackbar si falla el cambio de pago", async () => {
    const listener = vi.fn();
    window.addEventListener("rffm.show_snackbar", listener);
    setQuinielaTicketPayment.mockRejectedValue({ response: { data: { detail: "Jornada ya liquidada" } } });
    renderPage();
    await screen.findByText("Pablo Vega");

    fireEvent.click(screen.getByRole("button", { name: /pagado en efectivo/i }));

    await waitFor(() => expect(listener).toHaveBeenCalled());
    const event = listener.mock.calls[0][0] as CustomEvent<{ message: string; severity: string }>;
    expect(event.detail).toEqual({ message: "Jornada ya liquidada", severity: "error" });
    window.removeEventListener("rffm.show_snackbar", listener);
  });

  it("pide confirmación antes de liquidar y no llama a settle al cancelar", async () => {
    renderPage();
    await screen.findByText("Carla Ruiz");

    fireEvent.click(screen.getByRole("button", { name: /cerrar jornada y repartir/i }));
    const dialog = await screen.findByRole("dialog");
    expect(settleQuiniela).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: /cancelar/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(settleQuiniela).not.toHaveBeenCalled();
  });

  it("liquida la jornada tras confirmar y refresca la bolsa", async () => {
    settleQuiniela.mockResolvedValue({ collected: 2, prizePool: 4.6, fundAmount: 0.9, carryOut: 0, tickets: [] });
    renderPage();
    await screen.findByText("Carla Ruiz");

    fireEvent.click(screen.getByRole("button", { name: /cerrar jornada y repartir/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /^repartir$/i }));

    await waitFor(() => expect(settleQuiniela).toHaveBeenCalledWith("team-1", "j1"));
    await waitFor(() => expect(getQuinielaPayments).toHaveBeenCalledTimes(2));
  });

  it("no permite liquidar ni cambiar pagos si la jornada ya está liquidada", async () => {
    const base = payments();
    getQuinielaPayments.mockResolvedValue(payments({ jornada: { ...base.jornada, status: "Settled" } }));
    renderPage();
    await screen.findByText("Carla Ruiz");

    expect(screen.queryByRole("button", { name: /cerrar jornada y repartir/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /deshacer/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /pagado en efectivo/i })).not.toBeInTheDocument();
  });

  it("muestra el plazo de pago y el aviso de boletos pendientes", async () => {
    renderPage();
    await screen.findByText("Carla Ruiz");
    expect(screen.getByText(/plazo de pago/i)).toBeInTheDocument();
    expect(screen.getByText(/1 boleto pendiente/i)).toBeInTheDocument();
  });

  it("lista los movimientos de la bolsa", async () => {
    renderPage();
    await screen.findByText("Carla Ruiz");
    const movements = screen.getByRole("region", { name: /movimientos de la bolsa/i });
    expect(within(movements).getByText("Cobro · Carla Ruiz")).toBeInTheDocument();
    expect(within(movements).getByText("+1,00 €")).toBeInTheDocument();
  });

  it("muestra un mensaje de error si no se pueden cargar los pagos", async () => {
    const listener = vi.fn();
    window.addEventListener("rffm.show_snackbar", listener);
    getQuinielaPayments.mockRejectedValue(new Error("boom"));
    renderPage();

    expect(await screen.findByText(/no se pudo cargar la bolsa/i)).toBeInTheDocument();
    expect(listener).toHaveBeenCalled();
    window.removeEventListener("rffm.show_snackbar", listener);
  });

  it("redirige a la quiniela del participante si el usuario no es entrenador", async () => {
    getCurrentQuiniela.mockResolvedValue(currentFor(false));
    renderPage();

    expect(await screen.findByText("Pagina de participante")).toBeInTheDocument();
    expect(getQuinielaPayments).not.toHaveBeenCalled();
  });

  it("indica que no hay jornada abierta cuando no existe", async () => {
    getCurrentQuiniela.mockResolvedValue({ ...currentFor(true), isOpen: false, jornada: null });
    renderPage();

    expect(await screen.findByText(/no hay ninguna jornada/i)).toBeInTheDocument();
    expect(getQuinielaPayments).not.toHaveBeenCalled();
  });
});
