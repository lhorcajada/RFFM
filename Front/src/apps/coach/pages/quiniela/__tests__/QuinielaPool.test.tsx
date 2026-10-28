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
const deleteQuinielaTicket = vi.fn();
const resetQuiniela = vi.fn();
const getQuinielaSettings = vi.fn();
const updateQuinielaSettings = vi.fn();
vi.mock("../../../services/quinielaService", () => ({
  getQuinielaSettings: (...args: unknown[]) => getQuinielaSettings(...args),
  updateQuinielaSettings: (...args: unknown[]) => updateQuinielaSettings(...args),
  deleteQuinielaTicket: (...args: unknown[]) => deleteQuinielaTicket(...args),
  resetQuiniela: (...args: unknown[]) => resetQuiniela(...args),
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
    picks: [
      { recordCode: "m1", sign: "1" },
      { recordCode: "m2", sign: "X" },
    ],
    plenoHome: 1,
    plenoAway: 0,
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
    totals: { collected: 2, pending: 1, prizePool: 4.6, fundAmount: 0.9, carryIn: 3.5, carryOut: null, prizes: 0, prizePercent: 100, possiblePrizePool: 6.5 },
    movements: [{ id: "mv1", amount: 1, occurredAt: "2026-10-28T17:20:00Z", description: "Cobro · Carla Ruiz" }],
    matches: [
      { recordCode: "m1", homeTeam: "CD Los Olivos", awayTeam: "UD Sierra Norte", kickoffUtc: "2026-10-31T09:00:00Z", isValid: true, isPleno: false, homeGoals: null, awayGoals: null, isFinal: false },
      { recordCode: "m2", homeTeam: "Real Valdemar", awayTeam: "CD Las Encinas", kickoffUtc: "2026-10-31T11:00:00Z", isValid: true, isPleno: true, homeGoals: null, awayGoals: null, isFinal: false },
    ],
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
    getQuinielaSettings.mockResolvedValue({ fundPercent: 0 });
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
      totals: { collected: 3, pending: 0, prizePool: 5.15, fundAmount: 1.35, carryIn: 3.5, carryOut: null, prizes: 0, prizePercent: 100, possiblePrizePool: 6.65 },
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

  it("muestra la bolsa posible con los boletos pagados y los pendientes", async () => {
    renderPage();
    await screen.findByText("Carla Ruiz");
    const possible = stat("Bolsa posible");
    expect(within(possible).getByText("6,50 €")).toBeInTheDocument();
    expect(within(possible).getByText(/si se pagan los pendientes/i)).toBeInTheDocument();
  });

  it("despliega el boleto rellenado de un participante y lo vuelve a ocultar", async () => {
    renderPage();
    await screen.findByText("Pablo Vega");
    expect(screen.queryByTestId("ticket-pick")).not.toBeInTheDocument();

    const toggle = screen.getByRole("button", { name: /ver boleto de pablo vega/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);

    expect(screen.getAllByTestId("ticket-pick")).toHaveLength(2);
    expect(screen.getByRole("button", { name: /ocultar boleto de pablo vega/i })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText("Pronóstico: 1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /ocultar boleto de pablo vega/i }));
    expect(screen.queryByTestId("ticket-pick")).not.toBeInTheDocument();
  });

  it("lista los ganadores cuando la jornada está liquidada", async () => {
    const base = payments();
    getQuinielaPayments.mockResolvedValue(
      payments({
        jornada: { ...base.jornada, status: "Settled" },
        tickets: [
          ticket({ id: "t1", userName: "Carla Ruiz", hits: 14, category: "Special", prize: 6.5 }),
          ticket({ id: "t2", userId: "u2", userName: "Lucas Medina", hits: 9, category: "None", prize: 0 }),
        ],
      }),
    );
    renderPage();
    await screen.findByText("Lucas Medina");

    const winners = screen.getByRole("region", { name: /ganadores/i });
    expect(within(winners).getByText("Carla Ruiz")).toBeInTheDocument();
    expect(within(winners).getByText("6,50 €")).toBeInTheDocument();
    expect(within(winners).queryByText("Lucas Medina")).not.toBeInTheDocument();
  });

  it("indica que no hay acertantes si nadie ha ganado premio", async () => {
    const base = payments();
    getQuinielaPayments.mockResolvedValue(
      payments({
        jornada: { ...base.jornada, status: "Settled" },
        tickets: [ticket({ id: "t2", userId: "u2", userName: "Lucas Medina", hits: 9, category: "None", prize: 0 })],
      }),
    );
    renderPage();
    await screen.findByText("Lucas Medina");

    expect(within(screen.getByRole("region", { name: /ganadores/i })).getByText(/sin acertantes/i)).toBeInTheDocument();
  });

  it("no muestra el bloque de ganadores mientras la jornada está abierta", async () => {
    renderPage();
    await screen.findByText("Carla Ruiz");
    expect(screen.queryByRole("region", { name: /ganadores/i })).not.toBeInTheDocument();
  });

  it("revisa la última jornada liquidada cuando no hay ninguna abierta", async () => {
    getCurrentQuiniela.mockResolvedValue({
      ...currentFor(true),
      isOpen: false,
      jornada: null,
      previous: { jornadaId: "j0", roundNumber: 6, settledAt: "2026-10-26T10:00:00Z", carryOut: 0, myHits: null, myCategory: null, myPrize: null, winners: [] },
    });
    renderPage();

    await screen.findByText("Carla Ruiz");
    expect(getQuinielaPayments).toHaveBeenCalledWith("team-1", "j0");
  });

  it("muestra el bote acumulado de jornadas anteriores", async () => {
    renderPage();
    await screen.findByText("Carla Ruiz");
    expect(within(stat("Bote acumulado")).getByText("3,50 €")).toBeInTheDocument();
  });

  it("explica el reparto según el porcentaje de premios de la jornada", async () => {
    getQuinielaPayments.mockResolvedValue(
      payments({ totals: { ...payments().totals, prizePercent: 80 } }),
    );
    renderPage();
    await screen.findByText("Carla Ruiz");
    expect(within(stat("Premios de la jornada")).getByText(/80 % de lo cobrado/)).toBeInTheDocument();
    expect(within(stat("Fondo del equipo")).getByText(/20 % restante/)).toBeInTheDocument();
  });

  it("carga el porcentaje del fondo configurado en el formulario de reparto", async () => {
    getQuinielaSettings.mockResolvedValue({ fundPercent: 15 });
    renderPage();
    await screen.findByText("Carla Ruiz");
    expect(await screen.findByLabelText(/porcentaje para el fondo/i)).toHaveValue(15);
  });

  it("guarda el porcentaje del fondo y refresca la bolsa", async () => {
    updateQuinielaSettings.mockResolvedValue({ fundPercent: 20 });
    renderPage();
    await screen.findByText("Carla Ruiz");
    const input = await screen.findByLabelText(/porcentaje para el fondo/i);

    fireEvent.change(input, { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar reparto/i }));

    await waitFor(() => expect(updateQuinielaSettings).toHaveBeenCalledWith("team-1", 20));
    await waitFor(() => expect(getQuinielaPayments).toHaveBeenCalledTimes(2));
  });

  it("no permite guardar un porcentaje fuera de 0-100", async () => {
    renderPage();
    await screen.findByText("Carla Ruiz");
    const input = await screen.findByLabelText(/porcentaje para el fondo/i);

    fireEvent.change(input, { target: { value: "101" } });

    expect(screen.getByRole("button", { name: /guardar reparto/i })).toBeDisabled();
  });

  it("avisa con un snackbar si falla el guardado del reparto", async () => {
    const listener = vi.fn();
    window.addEventListener("rffm.show_snackbar", listener);
    updateQuinielaSettings.mockRejectedValue({ response: { data: { detail: "No tienes permiso" } } });
    renderPage();
    await screen.findByText("Carla Ruiz");
    fireEvent.change(await screen.findByLabelText(/porcentaje para el fondo/i), { target: { value: "10" } });

    fireEvent.click(screen.getByRole("button", { name: /guardar reparto/i }));

    await waitFor(() => expect(listener).toHaveBeenCalled());
    const event = listener.mock.calls[0][0] as CustomEvent<{ message: string; severity: string }>;
    expect(event.detail).toEqual({ message: "No tienes permiso", severity: "error" });
    window.removeEventListener("rffm.show_snackbar", listener);
  });

  it("se actualiza sola cuando vuelves a la pestaña y hay un boleto nuevo", async () => {
    const withNewTicket = payments({
      tickets: [...payments().tickets, ticket({ id: "t4", userId: "u4", userName: "Nuria Gil", paymentStatus: "Pending", paymentMethod: null, paidAt: null })],
    });
    getQuinielaPayments.mockResolvedValueOnce(payments()).mockResolvedValue(withNewTicket);
    renderPage();
    await screen.findByText("Carla Ruiz");
    expect(screen.queryByText("Nuria Gil")).not.toBeInTheDocument();

    document.dispatchEvent(new Event("visibilitychange"));

    expect(await screen.findByText("Nuria Gil")).toBeInTheDocument();
  });

  it("elimina un boleto tras confirmar y refresca la bolsa", async () => {
    deleteQuinielaTicket.mockResolvedValue(undefined);
    renderPage();
    await screen.findByText("Pablo Vega");

    fireEvent.click(screen.getByRole("button", { name: /eliminar boleto de pablo vega/i }));
    const dialog = await screen.findByRole("dialog");
    expect(deleteQuinielaTicket).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: /^eliminar$/i }));

    await waitFor(() => expect(deleteQuinielaTicket).toHaveBeenCalledWith("team-1", "j1", "t3"));
    await waitFor(() => expect(getQuinielaPayments).toHaveBeenCalledTimes(2));
  });

  it("no elimina el boleto si se cancela la confirmación", async () => {
    renderPage();
    await screen.findByText("Pablo Vega");

    fireEvent.click(screen.getByRole("button", { name: /eliminar boleto de pablo vega/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /cancelar/i }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(deleteQuinielaTicket).not.toHaveBeenCalled();
  });

  it("avisa con un snackbar si falla la eliminación del boleto", async () => {
    const listener = vi.fn();
    window.addEventListener("rffm.show_snackbar", listener);
    deleteQuinielaTicket.mockRejectedValue({ response: { data: { detail: "Jornada ya liquidada" } } });
    renderPage();
    await screen.findByText("Pablo Vega");

    fireEvent.click(screen.getByRole("button", { name: /eliminar boleto de pablo vega/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /^eliminar$/i }));

    await waitFor(() => expect(listener).toHaveBeenCalled());
    const event = listener.mock.calls[0][0] as CustomEvent<{ message: string; severity: string }>;
    expect(event.detail).toEqual({ message: "Jornada ya liquidada", severity: "error" });
    window.removeEventListener("rffm.show_snackbar", listener);
  });

  it("reinicia la jornada tras confirmar y vuelve a la quiniela del participante", async () => {
    resetQuiniela.mockResolvedValue(undefined);
    renderPage();
    await screen.findByText("Carla Ruiz");

    fireEvent.click(screen.getByRole("button", { name: /reiniciar jornada/i }));
    const dialog = await screen.findByRole("dialog");
    expect(resetQuiniela).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: /^reiniciar$/i }));

    await waitFor(() => expect(resetQuiniela).toHaveBeenCalledWith("team-1", "j1"));
    expect(await screen.findByText("Pagina de participante")).toBeInTheDocument();
  });

  it("no reinicia la jornada si se cancela la confirmación", async () => {
    renderPage();
    await screen.findByText("Carla Ruiz");

    fireEvent.click(screen.getByRole("button", { name: /reiniciar jornada/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /cancelar/i }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(resetQuiniela).not.toHaveBeenCalled();
  });

  it("no permite liquidar ni cambiar pagos si la jornada ya está liquidada", async () => {
    const base = payments();
    getQuinielaPayments.mockResolvedValue(payments({ jornada: { ...base.jornada, status: "Settled" } }));
    renderPage();
    await screen.findByText("Carla Ruiz");

    expect(screen.queryByRole("button", { name: /reiniciar jornada/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /eliminar boleto de/i })).not.toBeInTheDocument();
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
