import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { QuinielaWallet, QuinielaWalletMovement } from "../../../../services/quinielaService";
import WalletMovementsDialog from "../WalletMovementsDialog";

function movement(overrides: Partial<QuinielaWalletMovement>): QuinielaWalletMovement {
  return {
    id: "m1",
    type: "TopUp",
    amount: 5,
    occurredAt: "2026-10-28T17:20:00Z",
    description: null,
    ticketId: null,
    ...overrides,
  };
}

function wallet(movements: QuinielaWalletMovement[], totalMovements = movements.length): QuinielaWallet {
  return { userId: "u1", userName: "Carla Ruiz", role: "FamilyPlayer", balance: 3, totalMovements, movements };
}

const fetchPage = vi.fn();

function renderDialog() {
  return render(<WalletMovementsDialog open title="Mi monedero" fetchPage={fetchPage} onClose={vi.fn()} />);
}

describe("WalletMovementsDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra cada movimiento con su tipo y el signo del importe", async () => {
    fetchPage.mockResolvedValue(
      wallet([
        movement({ id: "a", type: "TicketCharge", amount: -1 }),
        movement({ id: "b", type: "TopUp", amount: 5, description: "Bizum" }),
        movement({ id: "c", type: "TicketRefund", amount: 1 }),
      ]),
    );
    renderDialog();
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("Cobro de boleto")).toBeInTheDocument();
    expect(within(dialog).getByText(/−1,00\s€/)).toBeInTheDocument();
    expect(within(dialog).getByText(/\+5,00\s€/)).toBeInTheDocument();
    expect(within(dialog).getByText("Bizum")).toBeInTheDocument();
    expect(within(dialog).getByText("Reembolso de boleto")).toBeInTheDocument();
    expect(within(dialog).queryByRole("table")).not.toBeInTheDocument();
  });

  it("muestra un mensaje cuando no hay movimientos", async () => {
    fetchPage.mockResolvedValue(wallet([]));
    renderDialog();
    expect(await screen.findByText(/aún no hay movimientos/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /cargar más/i })).not.toBeInTheDocument();
  });

  it("carga la primera página con límite 25 y offset 0", async () => {
    fetchPage.mockResolvedValue(wallet([]));
    renderDialog();
    await screen.findByText(/aún no hay movimientos/i);
    expect(fetchPage).toHaveBeenCalledWith(25, 0);
  });

  it("«Cargar más» pide la siguiente página y añade los movimientos", async () => {
    fetchPage
      .mockResolvedValueOnce(wallet([movement({ id: "a", type: "TopUp", amount: 5 })], 2))
      .mockResolvedValueOnce(wallet([movement({ id: "b", type: "Adjustment", amount: -2 })], 2));
    renderDialog();
    fireEvent.click(await screen.findByRole("button", { name: /cargar más/i }));

    await waitFor(() => expect(fetchPage).toHaveBeenLastCalledWith(25, 1));
    expect(await screen.findByText("Ajuste")).toBeInTheDocument();
    expect(screen.getByText("Recarga")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /cargar más/i })).not.toBeInTheDocument();
  });

  it("avisa si no se puede cargar el historial", async () => {
    fetchPage.mockRejectedValue(new Error("fallo"));
    renderDialog();
    expect(await screen.findByText(/no se pudo cargar el historial/i)).toBeInTheDocument();
  });
});
