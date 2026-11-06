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
const creditQuinielaPrizes = vi.fn();
vi.mock("../../../services/quinielaService", () => ({
  getQuinielaWallets: (...args: unknown[]) => getQuinielaWallets(...args),
  getQuinielaWalletOf: (...args: unknown[]) => getQuinielaWalletOf(...args),
  topUpQuinielaWallet: (...args: unknown[]) => topUpQuinielaWallet(...args),
  adjustQuinielaWallet: (...args: unknown[]) => adjustQuinielaWallet(...args),
  creditQuinielaPrizes: (...args: unknown[]) => creditQuinielaPrizes(...args),
}));

import QuinielaWallets from "../QuinielaWallets";

const wallets: QuinielaWalletSummary[] = [
  { userId: "u1", userName: "Carla Ruiz", role: "FamilyPlayer", balance: 3, associatedPlayers: [] },
  { userId: "u2", userName: "Pablo Gil", role: "Player", balance: 0, associatedPlayers: [] },
  { userId: "u3", userName: "Luis Mora", role: "Coach", balance: 1.5, associatedPlayers: [] },
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

  describe("abonar premios pendientes", () => {
    beforeEach(() => {
      getQuinielaWallets.mockResolvedValue(wallets);
    });

    it("pide confirmación y abona los premios mostrando el total", async () => {
      creditQuinielaPrizes.mockResolvedValue({ tickets: 2, total: 5.5 });
      const snackbars = captureSnackbars();
      renderPage();
      fireEvent.click(await screen.findByRole("button", { name: /abonar premios pendientes/i }));
      expect(creditQuinielaPrizes).not.toHaveBeenCalled();
      fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: /^abonar$/i }));
      await waitFor(() => expect(creditQuinielaPrizes).toHaveBeenCalledWith("team-1"));
      await waitFor(() => expect(snackbars.messages().some((m) => m.severity === "success" && m.message.includes("2 premios"))).toBe(true));
      expect(getQuinielaWallets).toHaveBeenCalledTimes(2);
      snackbars.stop();
    });

    it("avisa de que no queda nada por abonar", async () => {
      creditQuinielaPrizes.mockResolvedValue({ tickets: 0, total: 0 });
      const snackbars = captureSnackbars();
      renderPage();
      fireEvent.click(await screen.findByRole("button", { name: /abonar premios pendientes/i }));
      fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: /^abonar$/i }));
      await waitFor(() => expect(snackbars.messages().some((m) => m.message.includes("No queda ningún premio"))).toBe(true));
      snackbars.stop();
    });

    it("muestra un error si falla el abono", async () => {
      creditQuinielaPrizes.mockRejectedValue(new Error("boom"));
      const snackbars = captureSnackbars();
      renderPage();
      fireEvent.click(await screen.findByRole("button", { name: /abonar premios pendientes/i }));
      fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: /^abonar$/i }));
      await waitFor(() => expect(snackbars.messages().some((m) => m.severity === "error")).toBe(true));
      snackbars.stop();
    });
  });

  describe("jugadores asociados y buscador", () => {
    const jose = { id: "tp-jose", name: "José Pérez" };
    const lucia = { id: "tp-lucia", name: "Lucía Pérez" };
    const ana = { id: "tp-ana", name: "Ana Lopez" };
    const otro = { id: "tp-otro", name: "Otro Niño" };

    const listWithPlayers: QuinielaWalletSummary[] = [
      { userId: "u-jose", userName: "José Pérez", role: "Player", balance: 0, associatedPlayers: [jose] },
      { userId: "u-marta", userName: "Marta", role: "FamilyPlayer", balance: 12.5, associatedPlayers: [jose, lucia, ana] },
      { userId: "u-pedro", userName: "Pedro", role: "FamilyPlayer", balance: 0, associatedPlayers: [jose] },
      { userId: "u-rosa", userName: "Rosa", role: "FamilyPlayer", balance: 0, associatedPlayers: [otro] },
      { userId: "u-luis", userName: "Luis Mora", role: "Coach", balance: 1.5, associatedPlayers: [] },
      { userId: "u-carla", userName: "Carla Ruiz", role: "FamilyPlayer", balance: 0, associatedPlayers: [] },
    ];

    const searchBox = () => screen.getByRole("textbox", { name: "Buscar por jugador o familiar" });
    const playersAreaOf = (card: HTMLElement) => within(card).getByRole("list", { name: /jugadores/i });
    const type = (text: string) => fireEvent.change(searchBox(), { target: { value: text } });

    beforeEach(() => {
      getQuinielaWallets.mockResolvedValue(listWithPlayers);
    });

    it("muestra en la tarjeta de un familiar con un jugador el nombre de ese jugador", async () => {
      renderPage();
      await screen.findByText("Pedro");

      expect(within(playersAreaOf(cardOf("Pedro"))).getByText("José Pérez")).toBeInTheDocument();
    });

    it("muestra los tres jugadores de un familiar dentro de una sola tarjeta y su nombre una sola vez en la lista", async () => {
      renderPage();
      await screen.findByText("Marta");

      const area = playersAreaOf(cardOf("Marta"));
      expect(within(area).getByText("José Pérez")).toBeInTheDocument();
      expect(within(area).getByText("Lucía Pérez")).toBeInTheDocument();
      expect(within(area).getByText("Ana Lopez")).toBeInTheDocument();
      expect(screen.getAllByText("Marta")).toHaveLength(1);
    });

    it("muestra el propio jugador en la tarjeta de una fila de jugador", async () => {
      renderPage();
      await screen.findByText("Pedro");

      expect(within(playersAreaOf(cardOf("Pedro"))).getByText("José Pérez")).toBeInTheDocument();
    });

    it("no muestra área de jugadores en la tarjeta del entrenador ni en un familiar sin jugadores", async () => {
      renderPage();
      await screen.findByText("Carla Ruiz");

      for (const name of ["Luis Mora", "Carla Ruiz"]) {
        const card = cardOf(name);
        expect(within(card).queryByRole("list", { name: /jugadores/i })).not.toBeInTheDocument();
        expect(within(card).getByText(name)).toBeInTheDocument();
      }
      expect(within(cardOf("Luis Mora")).getByText("Entrenador")).toBeInTheDocument();
      expect(within(cardOf("Carla Ruiz")).getByText(/0,00\s€/)).toBeInTheDocument();
    });

    it("filtra por el jugador escrito sin distinguir mayúsculas, acentos ni espacios", async () => {
      renderPage();
      await screen.findByText("Marta");

      type("  jOSE   perez ");

      expect(screen.getAllByTestId("wallet-card")).toHaveLength(3);
      expect(screen.getByText("Marta")).toBeInTheDocument();
      expect(screen.getByText("Pedro")).toBeInTheDocument();
      expect(screen.queryByText("Rosa")).not.toBeInTheDocument();
      expect(screen.queryByText("Luis Mora")).not.toBeInTheDocument();
      expect(screen.queryByText("Carla Ruiz")).not.toBeInTheDocument();
    });

    it("al buscar un familiar muestra todos sus jugadores", async () => {
      renderPage();
      await screen.findByText("Marta");

      type("marta");

      expect(screen.getAllByTestId("wallet-card")).toHaveLength(1);
      const area = playersAreaOf(cardOf("Marta"));
      expect(within(area).getByText("José Pérez")).toBeInTheDocument();
      expect(within(area).getByText("Lucía Pérez")).toBeInTheDocument();
      expect(within(area).getByText("Ana Lopez")).toBeInTheDocument();
    });

    it("muestra todas las tarjetas al dejar el buscador vacío o con solo espacios", async () => {
      renderPage();
      await screen.findByText("Marta");

      type("marta");
      expect(screen.getAllByTestId("wallet-card")).toHaveLength(1);
      type("");
      expect(screen.getAllByTestId("wallet-card")).toHaveLength(6);
      type("   ");
      expect(screen.getAllByTestId("wallet-card")).toHaveLength(6);
    });

    it("muestra no se encontraron resultados, y no el mensaje de equipo sin participantes, si ninguna fila coincide", async () => {
      renderPage();
      await screen.findByText("Marta");

      type("zzz");

      expect(await screen.findByText("No se encontraron resultados")).toBeInTheDocument();
      expect(screen.queryByText("No hay participantes en el equipo")).not.toBeInTheDocument();
    });

    it("anuncia el número de resultados al filtrar y el mensaje de sin resultados", async () => {
      renderPage();
      await screen.findByText("Marta");
      expect(screen.getByRole("status")).toBeEmptyDOMElement();

      type("jose perez");
      expect(screen.getByRole("status")).toHaveTextContent("3 resultados");

      type("marta");
      expect(screen.getByRole("status")).toHaveTextContent("1 resultado");
      expect(screen.getByRole("status")).not.toHaveTextContent("1 resultados");

      type("zzz");
      expect(screen.getByRole("status")).toHaveTextContent("0 resultados");

      type("  ");
      expect(screen.getByRole("status")).toBeEmptyDOMElement();
    });

    it("muestra no hay participantes antes y después de escribir si el equipo no tiene participantes", async () => {
      getQuinielaWallets.mockResolvedValue([]);
      renderPage();
      expect(await screen.findByText("No hay participantes en el equipo")).toBeInTheDocument();

      type("zzz");

      expect(screen.getByText("No hay participantes en el equipo")).toBeInTheDocument();
      expect(screen.queryByText("No se encontraron resultados")).not.toBeInTheDocument();
    });

    it("no vuelve a llamar a la API al escribir en el buscador", async () => {
      renderPage();
      await screen.findByText("Marta");

      type("jose");
      type("pe");

      expect(getQuinielaWallets).toHaveBeenCalledTimes(1);
    });
  });
});
