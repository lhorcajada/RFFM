import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserProvider } from "../../../../../shared/context/UserContext";

const getTeamTransactionsMock = vi.fn();
vi.mock("../../../services/transactionService", () => ({
  default: {
    getTeamTransactions: (...args: unknown[]) => getTeamTransactionsMock(...args),
  },
  getTeamTransactions: (...args: unknown[]) => getTeamTransactionsMock(...args),
}));

const resolveUserTeamIdMock = vi.fn();
vi.mock("../../../../../shared/hooks/resolveUserTeamId", () => ({
  default: () => resolveUserTeamIdMock(),
}));

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

import Transactions from "../Transactions";

type MockFilters = {
  status?: "Pending" | "Paid";
  type?: "Sanction" | "Lottery" | "Quiniela" | "WalletTopUp" | "WalletCharge";
};

const paidQuiniela = {
  id: "t1",
  type: "Quiniela",
  personName: "Juan Pérez",
  amount: 10,
  pendingAmount: null,
  date: "2026-03-05T00:00:00Z",
  description: "Quiniela jornada 3",
  status: "Paid",
};

const pendingSanction = {
  id: "s1",
  type: "Sanction",
  personName: "Ana López",
  amount: 100,
  pendingAmount: 60,
  date: "2026-03-01T00:00:00Z",
  description: "Expulsión",
  status: "Pending",
};

const paidLottery = {
  id: "l1",
  type: "Lottery",
  personName: "Luis Gómez",
  amount: 15,
  pendingAmount: null,
  date: "2026-02-20T00:00:00Z",
  description: "Taco 1",
  status: "Paid",
};

const ALL_TRANSACTIONS = [paidQuiniela, pendingSanction, paidLottery];

function filterTransactions(filters?: MockFilters) {
  return ALL_TRANSACTIONS.filter(
    (transaction) =>
      (!filters?.status || transaction.status === filters.status) &&
      (!filters?.type || transaction.type === filters.type)
  );
}

function renderTransactions(initialEntry = "/coach/transactions") {
  return render(
    <UserProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Transactions />
      </MemoryRouter>
    </UserProvider>
  );
}

describe("Transactions — tarjetas, filtros y estados de la página de transacciones", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveUserTeamIdMock.mockResolvedValue("team-3");
    getTeamTransactionsMock.mockImplementation((_teamId: string, filters?: MockFilters) =>
      Promise.resolve(filterTransactions(filters))
    );
  });

  it("muestra una tarjeta por transacción con el estado traducido y el importe pendiente", async () => {
    getTeamTransactionsMock.mockResolvedValueOnce([paidQuiniela, pendingSanction]);

    renderTransactions("/coach/transactions?teamId=team-1");

    const cards = await screen.findAllByRole("article");
    expect(cards).toHaveLength(2);
    expect(cards[0].textContent).toContain("Pagado");
    expect(cards[1].textContent).toContain("Pendiente de pago");
    expect(cards[1].textContent).toContain("60");
  });

  it("el filtro de estado 'Pendientes' vuelve a pedir las transacciones pendientes y muestra solo esas tarjetas", async () => {
    renderTransactions("/coach/transactions?teamId=team-1");
    await screen.findAllByRole("article");

    await userEvent.click(screen.getByRole("button", { name: /^pendientes$/i }));

    await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(1));
    expect(getTeamTransactionsMock).toHaveBeenLastCalledWith("team-1", { status: "Pending" });
    expect(screen.getByRole("article").textContent).toContain("Pendiente de pago");
  });

  it("el filtro de tipo 'Lotería' vuelve a pedir las transacciones de lotería", async () => {
    renderTransactions("/coach/transactions?teamId=team-1");
    await screen.findAllByRole("article");

    await userEvent.click(screen.getByRole("button", { name: /^lotería$/i }));

    await waitFor(() =>
      expect(getTeamTransactionsMock).toHaveBeenLastCalledWith("team-1", { type: "Lottery" })
    );
    await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(1));
  });

  it("no usa tabla ni cabeceras de columna para mostrar las transacciones", async () => {
    renderTransactions("/coach/transactions?teamId=team-1");
    await screen.findAllByRole("article");

    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("columnheader")).toBeNull();
  });

  it("muestra un mensaje de error y ninguna tarjeta cuando la petición falla", async () => {
    getTeamTransactionsMock.mockRejectedValueOnce(new Error("Network Error"));

    renderTransactions("/coach/transactions?teamId=team-1");

    await screen.findByRole("alert");
    expect(screen.queryAllByRole("article")).toHaveLength(0);
  });

  it("muestra el mensaje de lista vacía y no muestra error cuando el equipo no tiene transacciones", async () => {
    getTeamTransactionsMock.mockResolvedValueOnce([]);

    renderTransactions("/coach/transactions?teamId=team-1");

    await screen.findByText(/no hay transacciones/i);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryAllByRole("article")).toHaveLength(0);
  });

  it("usa el teamId de la URL para pedir las transacciones", async () => {
    renderTransactions("/coach/transactions?teamId=team-9");

    await waitFor(() => expect(getTeamTransactionsMock.mock.calls[0]?.[0]).toBe("team-9"));
  });

  it("sin teamId en la URL usa el equipo resuelto para el usuario actual", async () => {
    renderTransactions("/coach/transactions");

    await waitFor(() => expect(getTeamTransactionsMock.mock.calls[0]?.[0]).toBe("team-3"));
  });
});
