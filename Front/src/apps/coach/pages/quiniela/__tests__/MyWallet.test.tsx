import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { QuinielaWallet, QuinielaWalletMovement } from "../../../services/quinielaService";
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

const getMyQuinielaWallet = vi.fn();
const donateFromQuinielaWallet = vi.fn();
vi.mock("../../../services/quinielaService", () => ({
  getMyQuinielaWallet: (...args: unknown[]) => getMyQuinielaWallet(...args),
  donateFromQuinielaWallet: (...args: unknown[]) => donateFromQuinielaWallet(...args),
}));

import MyWallet from "../MyWallet";

function walletOf(balance: number, overrides: Partial<QuinielaWallet> = {}): QuinielaWallet {
  return { userId: "u1", userName: "Yo", role: "Player", balance, totalMovements: 0, movements: [], ...overrides };
}

function movement(id: string, amount: number): QuinielaWalletMovement {
  return { id, type: "TopUp", amount, occurredAt: "2026-10-28T17:20:00Z", description: `Recarga ${id}`, ticketId: null };
}

function renderPage() {
  return render(
    <UserProvider>
      <MemoryRouter initialEntries={["/coach/quiniela/mi-monedero?teamId=team-1"]}>
        <Routes>
          <Route path="/coach/quiniela/mi-monedero" element={<MyWallet />} />
          <Route path="/coach/quiniela" element={<div>Pantalla de la quiniela</div>} />
        </Routes>
      </MemoryRouter>
    </UserProvider>,
  );
}

function captureSnackbars() {
  const listener = vi.fn();
  window.addEventListener("rffm.show_snackbar", listener);
  const messages = () => listener.mock.calls.map((call) => (call[0] as CustomEvent<{ message: string; severity: string }>).detail);
  return { messages, stop: () => window.removeEventListener("rffm.show_snackbar", listener) };
}

describe("MyWallet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMyQuinielaWallet.mockResolvedValue(walletOf(2.5));
  });

  it("muestra el saldo del monedero propio del equipo", async () => {
    renderPage();
    expect(await screen.findByText(/2,50\s€/)).toBeInTheDocument();
    expect(getMyQuinielaWallet).toHaveBeenCalledWith("team-1", { limit: 25, offset: 0 });
  });

  it("lista los movimientos sin abrir ningún diálogo", async () => {
    getMyQuinielaWallet.mockResolvedValue(walletOf(2.5, { totalMovements: 2, movements: [movement("a", 5), movement("b", -2.5)] }));
    renderPage();
    expect(await screen.findByText("Recarga a")).toBeInTheDocument();
    expect(screen.getByText("Recarga b")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("indica que aún no hay movimientos", async () => {
    renderPage();
    expect(await screen.findByText(/aún no hay movimientos/i)).toBeInTheDocument();
  });

  it("pide más movimientos con «Cargar más»", async () => {
    getMyQuinielaWallet
      .mockResolvedValueOnce(walletOf(2.5, { totalMovements: 2, movements: [movement("a", 5)] }))
      .mockResolvedValueOnce(walletOf(2.5, { totalMovements: 2, movements: [movement("b", 1)] }));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /cargar más/i }));
    expect(await screen.findByText("Recarga b")).toBeInTheDocument();
    expect(getMyQuinielaWallet).toHaveBeenLastCalledWith("team-1", { limit: 25, offset: 1 });
  });

  it("avisa si no se puede cargar el monedero", async () => {
    getMyQuinielaWallet.mockRejectedValue(new Error("boom"));
    renderPage();
    expect(await screen.findByText(/no se pudo cargar el monedero/i)).toBeInTheDocument();
  });

  it("vuelve a la quiniela con «Volver»", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /volver/i }));
    expect(await screen.findByText("Pantalla de la quiniela")).toBeInTheDocument();
  });

  describe("donar al equipo", () => {
    it("dona el importe, avisa y refresca el saldo", async () => {
      const snackbars = captureSnackbars();
      getMyQuinielaWallet.mockResolvedValueOnce(walletOf(5)).mockResolvedValue(walletOf(3));
      donateFromQuinielaWallet.mockResolvedValue({ userId: "u1", balance: 3, movement: {} });
      renderPage();
      fireEvent.click(await screen.findByRole("button", { name: /donar al equipo/i }));
      fireEvent.change(await screen.findByLabelText(/importe/i), { target: { value: "2" } });
      fireEvent.click(screen.getByRole("button", { name: /^donar$/i }));

      await waitFor(() => expect(donateFromQuinielaWallet).toHaveBeenCalledWith("team-1", 2));
      await waitFor(() => expect(snackbars.messages().some((m) => m.severity === "success" && /gracias/i.test(m.message))).toBe(true));
      expect(await screen.findByText(/3,00\s€/)).toBeInTheDocument();
      snackbars.stop();
    });

    it("muestra el error si la donación falla", async () => {
      const snackbars = captureSnackbars();
      getMyQuinielaWallet.mockResolvedValue(walletOf(5));
      donateFromQuinielaWallet.mockRejectedValue(new Error("boom"));
      renderPage();
      fireEvent.click(await screen.findByRole("button", { name: /donar al equipo/i }));
      fireEvent.change(await screen.findByLabelText(/importe/i), { target: { value: "2" } });
      fireEvent.click(screen.getByRole("button", { name: /^donar$/i }));

      await waitFor(() => expect(snackbars.messages().some((m) => m.severity === "error")).toBe(true));
      snackbars.stop();
    });

    it("despacha rffm.quiniela_wallet_updated tras donar", async () => {
      const listener = vi.fn();
      window.addEventListener("rffm.quiniela_wallet_updated", listener);
      getMyQuinielaWallet.mockResolvedValue(walletOf(5));
      donateFromQuinielaWallet.mockResolvedValue({ userId: "u1", balance: 3, movement: {} });
      renderPage();
      fireEvent.click(await screen.findByRole("button", { name: /donar al equipo/i }));
      fireEvent.change(await screen.findByLabelText(/importe/i), { target: { value: "2" } });
      fireEvent.click(screen.getByRole("button", { name: /^donar$/i }));

      await waitFor(() => expect(listener).toHaveBeenCalled());
      window.removeEventListener("rffm.quiniela_wallet_updated", listener);
    });
  });
});
