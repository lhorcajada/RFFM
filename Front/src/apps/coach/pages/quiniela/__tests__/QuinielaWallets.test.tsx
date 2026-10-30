import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { QuinielaWalletSummary } from "../../../services/quinielaService";
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

const getQuinielaWallets = vi.fn();
const getQuinielaWalletOf = vi.fn();
const topUpQuinielaWallet = vi.fn();
const adjustQuinielaWallet = vi.fn();
vi.mock("../../../services/quinielaService", () => ({
  getQuinielaWallets: (...args: unknown[]) => getQuinielaWallets(...args),
  getQuinielaWalletOf: (...args: unknown[]) => getQuinielaWalletOf(...args),
  topUpQuinielaWallet: (...args: unknown[]) => topUpQuinielaWallet(...args),
  adjustQuinielaWallet: (...args: unknown[]) => adjustQuinielaWallet(...args),
}));

import QuinielaWallets from "../QuinielaWallets";

const wallets: QuinielaWalletSummary[] = [
  { userId: "u1", userName: "Carla Ruiz", role: "FamilyPlayer", balance: 3 },
  { userId: "u2", userName: "Pablo Gil", role: "Player", balance: 0 },
  { userId: "u3", userName: "Luis Mora", role: "Coach", balance: 1.5 },
];

function operation(userId: string, balance: number) {
  return {
    userId,
    balance,
    movement: { id: "mv", type: "TopUp", amount: 5, occurredAt: "2026-10-28T17:20:00Z", description: null, ticketId: null },
  };
}

function renderPage() {
  return render(
    <UserProvider>
      <MemoryRouter initialEntries={["/coach/quiniela/monederos?teamId=team-1"]}>
        <Routes>
          <Route path="/coach/quiniela/monederos" element={<QuinielaWallets />} />
          <Route path="/coach/quiniela" element={<div>Pantalla de la quiniela</div>} />
        </Routes>
      </MemoryRouter>
    </UserProvider>,
  );
}

function cardOf(name: string): HTMLElement {
  return screen.getByText(name).closest("[data-testid='wallet-card']") as HTMLElement;
}

function captureSnackbars() {
  const listener = vi.fn();
  window.addEventListener("rffm.show_snackbar", listener);
  return {
    messages: () => listener.mock.calls.map((call) => (call[0] as CustomEvent<{ message: string; severity: string }>).detail),
    stop: () => window.removeEventListener("rffm.show_snackbar", listener),
  };
}

describe("QuinielaWallets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getQuinielaWallets.mockResolvedValue(wallets);
  });

  it("muestra una tarjeta por usuario con su rol en español y su saldo", async () => {
    renderPage();
    expect(await screen.findByText("Carla Ruiz")).toBeInTheDocument();
    expect(within(cardOf("Carla Ruiz")).getByText("Familiar")).toBeInTheDocument();
    expect(within(cardOf("Carla Ruiz")).getByText(/3,00\s€/)).toBeInTheDocument();
    expect(within(cardOf("Pablo Gil")).getByText("Jugador")).toBeInTheDocument();
    expect(within(cardOf("Pablo Gil")).getByText(/0,00\s€/)).toBeInTheDocument();
    expect(within(cardOf("Luis Mora")).getByText("Entrenador")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(getQuinielaWallets).toHaveBeenCalledWith("team-1");
  });

  it("vuelve a la quiniela si el usuario no es entrenador (403)", async () => {
    getQuinielaWallets.mockRejectedValue({ response: { status: 403 } });
    renderPage();
    expect(await screen.findByText("Pantalla de la quiniela")).toBeInTheDocument();
  });

  it("avisa si no se pueden cargar los monederos", async () => {
    getQuinielaWallets.mockRejectedValue({ response: { status: 500 } });
    renderPage();
    expect(await screen.findByText(/no se pudieron cargar los monederos/i)).toBeInTheDocument();
  });

  describe("recargar", () => {
    const openTopUp = async () => {
      renderPage();
      await screen.findByText("Carla Ruiz");
      fireEvent.click(within(cardOf("Carla Ruiz")).getByRole("button", { name: /recargar/i }));
      return screen.findByRole("dialog");
    };

    it("recarga un importe válido y actualiza el saldo de la tarjeta", async () => {
      const snackbars = captureSnackbars();
      topUpQuinielaWallet.mockResolvedValue(operation("u1", 8));
      const dialog = await openTopUp();
      fireEvent.change(within(dialog).getByLabelText(/importe/i), { target: { value: "5" } });
      fireEvent.change(within(dialog).getByLabelText(/descripción/i), { target: { value: "Bizum" } });
      fireEvent.click(within(dialog).getByRole("button", { name: /^recargar$/i }));

      await waitFor(() =>
        expect(topUpQuinielaWallet).toHaveBeenCalledWith("team-1", "u1", { amount: 5, description: "Bizum" }),
      );
      await waitFor(() => expect(within(cardOf("Carla Ruiz")).getByText(/8,00\s€/)).toBeInTheDocument());
      expect(snackbars.messages().some((m) => m.severity === "success")).toBe(true);
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      snackbars.stop();
    });

    it("despacha rffm.quiniela_wallet_updated tras recargar", async () => {
      const listener = vi.fn();
      window.addEventListener("rffm.quiniela_wallet_updated", listener);
      topUpQuinielaWallet.mockResolvedValue(operation("u1", 8));
      const dialog = await openTopUp();
      fireEvent.change(within(dialog).getByLabelText(/importe/i), { target: { value: "5" } });
      fireEvent.click(within(dialog).getByRole("button", { name: /^recargar$/i }));

      await waitFor(() => expect(listener).toHaveBeenCalledTimes(1));
      window.removeEventListener("rffm.quiniela_wallet_updated", listener);
    });

    it("acepta la coma decimal", async () => {
      topUpQuinielaWallet.mockResolvedValue(operation("u1", 5.5));
      const dialog = await openTopUp();
      fireEvent.change(within(dialog).getByLabelText(/importe/i), { target: { value: "2,5" } });
      fireEvent.click(within(dialog).getByRole("button", { name: /^recargar$/i }));
      await waitFor(() => expect(topUpQuinielaWallet).toHaveBeenCalledWith("team-1", "u1", { amount: 2.5, description: undefined }));
    });

    it.each(["", "0", "10,01", "1,234", "abc"])("no recarga el importe inválido «%s» y muestra el error", async (value) => {
      const dialog = await openTopUp();
      fireEvent.change(within(dialog).getByLabelText(/importe/i), { target: { value } });
      fireEvent.click(within(dialog).getByRole("button", { name: /^recargar$/i }));

      expect(await within(dialog).findByText(/importe/i, { selector: "p" })).toBeInTheDocument();
      expect(topUpQuinielaWallet).not.toHaveBeenCalled();
    });

    it("avisa con un error si la recarga falla", async () => {
      const snackbars = captureSnackbars();
      topUpQuinielaWallet.mockRejectedValue({ response: { data: { detail: "No se pudo recargar." } } });
      const dialog = await openTopUp();
      fireEvent.change(within(dialog).getByLabelText(/importe/i), { target: { value: "5" } });
      fireEvent.click(within(dialog).getByRole("button", { name: /^recargar$/i }));

      await waitFor(() => expect(snackbars.messages()).toContainEqual({ message: "No se pudo recargar.", severity: "error" }));
      snackbars.stop();
    });
  });

  describe("restar saldo", () => {
    const fillAdjustment = async (amount: string, reason: string) => {
      renderPage();
      await screen.findByText("Carla Ruiz");
      fireEvent.click(within(cardOf("Carla Ruiz")).getByRole("button", { name: /restar saldo/i }));
      const dialog = await screen.findByRole("dialog");
      fireEvent.change(within(dialog).getByLabelText(/importe/i), { target: { value: amount } });
      fireEvent.change(within(dialog).getByLabelText(/motivo/i), { target: { value: reason } });
      fireEvent.click(within(dialog).getByRole("button", { name: /continuar/i }));
    };

    it("pide confirmación antes de restar y no llama a la API hasta confirmar", async () => {
      adjustQuinielaWallet.mockResolvedValue(operation("u1", 1));
      await fillAdjustment("2", "Error de tecleo");

      const confirm = await screen.findByRole("dialog");
      expect(within(confirm).getByText(/2,00\s€/)).toBeInTheDocument();
      expect(adjustQuinielaWallet).not.toHaveBeenCalled();

      fireEvent.click(within(confirm).getByRole("button", { name: /^restar$/i }));
      await waitFor(() =>
        expect(adjustQuinielaWallet).toHaveBeenCalledWith("team-1", "u1", { amount: 2, reason: "Error de tecleo" }),
      );
      await waitFor(() => expect(within(cardOf("Carla Ruiz")).getByText(/1,00\s€/)).toBeInTheDocument());
    });

    it("no llama a la API si se cancela la confirmación", async () => {
      await fillAdjustment("2", "Error de tecleo");
      const confirm = await screen.findByRole("dialog");
      fireEvent.click(within(confirm).getByRole("button", { name: /cancelar/i }));
      await waitFor(() => expect(screen.queryByText(/se restarán/i)).not.toBeInTheDocument());
      expect(adjustQuinielaWallet).not.toHaveBeenCalled();
    });

    it("exige un motivo", async () => {
      renderPage();
      await screen.findByText("Carla Ruiz");
      fireEvent.click(within(cardOf("Carla Ruiz")).getByRole("button", { name: /restar saldo/i }));
      const dialog = await screen.findByRole("dialog");
      fireEvent.change(within(dialog).getByLabelText(/importe/i), { target: { value: "2" } });
      fireEvent.click(within(dialog).getByRole("button", { name: /continuar/i }));
      expect(await within(dialog).findByText(/indica el motivo/i)).toBeInTheDocument();
      expect(adjustQuinielaWallet).not.toHaveBeenCalled();
    });

    it("avisa con un error si el ajuste supera el saldo (409)", async () => {
      const snackbars = captureSnackbars();
      adjustQuinielaWallet.mockRejectedValue({
        response: { status: 409, data: { detail: "El ajuste supera el saldo del monedero.", code: "QuinielaWalletInsufficientBalance" } },
      });
      await fillAdjustment("9", "Corrección");
      const confirm = await screen.findByRole("dialog");
      fireEvent.click(within(confirm).getByRole("button", { name: /^restar$/i }));

      await waitFor(() =>
        expect(snackbars.messages()).toContainEqual({ message: "El ajuste supera el saldo del monedero.", severity: "error" }),
      );
      expect(within(cardOf("Carla Ruiz")).getByText(/3,00\s€/)).toBeInTheDocument();
      snackbars.stop();
    });
  });

  it("abre el historial del usuario con sus movimientos", async () => {
    getQuinielaWalletOf.mockResolvedValue({
      userId: "u1",
      userName: "Carla Ruiz",
      role: "FamilyPlayer",
      balance: 3,
      totalMovements: 1,
      movements: [{ id: "a", type: "TopUp", amount: 3, occurredAt: "2026-10-28T17:20:00Z", description: null, ticketId: null }],
    });
    renderPage();
    await screen.findByText("Carla Ruiz");
    fireEvent.click(within(cardOf("Carla Ruiz")).getByRole("button", { name: /movimientos/i }));

    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("Recarga")).toBeInTheDocument();
    expect(getQuinielaWalletOf).toHaveBeenCalledWith("team-1", "u1", { limit: 25, offset: 0 });
  });
});
