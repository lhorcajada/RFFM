import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { QuinielaCurrent, QuinielaHistory, QuinielaHistoryItem, QuinielaTicket } from "../../../services/quinielaService";
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

const getCurrentQuiniela = vi.fn();
const getQuinielaHistory = vi.fn();
vi.mock("../../../services/quinielaService", () => ({
  getCurrentQuiniela: (...args: unknown[]) => getCurrentQuiniela(...args),
  getQuinielaHistory: (...args: unknown[]) => getQuinielaHistory(...args),
}));

import QuinielaHistoryPage from "../QuinielaHistory";

function ticket(overrides: Partial<QuinielaTicket> = {}): QuinielaTicket {
  return {
    id: "tk1",
    number: 1,
    picks: [],
    plenoHome: 1,
    plenoAway: 1,
    paymentStatus: "Paid",
    paymentDeadlineUtc: null,
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
      id: "j2",
      teamId: "team-1",
      rffmRoundId: "r8",
      roundNumber: 8,
      roundName: "Jornada 8",
      price: 1,
      status: "Open",
      carryIn: 2,
      firstKickoffUtc: "2026-11-07T15:00:00Z",
      paymentDeadlineUtc: null,
      picksClosed: false,
    },
    matches: [],
    myTickets: [],
    pool: null,
    previous: null,
    canManage: false,
    ...overrides,
  };
}

function item(roundNumber: number, overrides: Partial<QuinielaHistoryItem> = {}): QuinielaHistoryItem {
  return {
    jornadaId: `j-${roundNumber}`,
    roundNumber,
    settledAt: "2026-11-01T20:00:00Z",
    carryOut: 1.25,
    collected: 8,
    prizePool: 4.4,
    myHits: null,
    myCategory: null,
    myPrize: null,
    winners: [],
    ...overrides,
  };
}

function history(items: QuinielaHistoryItem[], total = items.length): QuinielaHistory {
  return { total, items };
}

function renderPage() {
  return render(
    <UserProvider>
      <MemoryRouter initialEntries={["/coach/quiniela/historico?teamId=team-1"]}>
        <Routes>
          <Route path="/coach/quiniela/historico" element={<QuinielaHistoryPage />} />
          <Route path="/coach/quiniela" element={<div>Pantalla de la quiniela</div>} />
        </Routes>
      </MemoryRouter>
    </UserProvider>,
  );
}

describe("QuinielaHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentQuiniela.mockResolvedValue(current());
    getQuinielaHistory.mockResolvedValue(history([]));
  });

  describe("quiniela actual", () => {
    it("sin boleto ofrece «Rellenar mi boleto» hacia la quiniela del equipo", async () => {
      renderPage();

      const card = await screen.findByRole("region", { name: /quiniela actual/i });
      expect(card).toHaveTextContent("Jornada 8");
      expect(within(card).getByRole("link", { name: /rellenar mi boleto/i })).toHaveAttribute(
        "href",
        "/coach/quiniela?teamId=team-1",
      );
    });

    it("con boleto ofrece «Editar mi boleto»", async () => {
      getCurrentQuiniela.mockResolvedValue(current({ myTickets: [ticket()] }));
      renderPage();

      expect(await screen.findByRole("link", { name: /editar mi boleto/i })).toBeInTheDocument();
    });

    it("con el plazo cerrado ofrece «Ver mi boleto» y avisa de que los pronósticos están cerrados", async () => {
      const data = current({ myTickets: [ticket()] });
      data.jornada = { ...data.jornada!, picksClosed: true };
      getCurrentQuiniela.mockResolvedValue(data);
      renderPage();

      const card = await screen.findByRole("region", { name: /quiniela actual/i });
      expect(card).toHaveTextContent(/pronósticos cerrados/i);
      expect(within(card).getByRole("link", { name: /ver mi boleto/i })).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /editar mi boleto/i })).not.toBeInTheDocument();
    });

    it("sin quiniela abierta avisa de que aún no está abierta y no ofrece abrirla a un jugador", async () => {
      getCurrentQuiniela.mockResolvedValue(current({ isOpen: false, jornada: null }));
      renderPage();

      expect(await screen.findByText(/aún no está abierta/i)).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /abrir quiniela/i })).not.toBeInTheDocument();
    });

    it("sin quiniela abierta el entrenador ve «Abrir quiniela»", async () => {
      getCurrentQuiniela.mockResolvedValue(current({ isOpen: false, jornada: null, canManage: true }));
      renderPage();

      expect(await screen.findByRole("link", { name: /abrir quiniela/i })).toHaveAttribute(
        "href",
        "/coach/quiniela?teamId=team-1",
      );
    });
  });

  describe("jornadas liquidadas", () => {
    it("lista cada jornada con su bolsa, su bote y sus ganadores", async () => {
      getQuinielaHistory.mockResolvedValue(
        history([
          item(7, {
            winners: [
              { userName: "Carla Ruiz", category: "Special", hits: 14, prize: 6.5, ticketNumber: 1 },
              { userName: "Lucas Medina", category: "Second", hits: 12, prize: 2, ticketNumber: 2 },
            ],
          }),
          item(6),
        ]),
      );
      renderPage();

      const first = await screen.findByRole("region", { name: /jornada 7/i });
      expect(first).toHaveTextContent("Carla Ruiz");
      expect(first).toHaveTextContent("Categoría Especial");
      expect(first).toHaveTextContent(/6,50\s€/);
      expect(first).toHaveTextContent("Lucas Medina · Boleto 2");
      expect(first).toHaveTextContent(/4,40\s€/);
      expect(first).toHaveTextContent(/1,25\s€/);
      expect(screen.getByRole("region", { name: /jornada 6/i })).toBeInTheDocument();
    });

    it("una jornada sin acertantes lo dice y muestra el bote que pasa a la siguiente", async () => {
      getQuinielaHistory.mockResolvedValue(history([item(6)]));
      renderPage();

      const card = await screen.findByRole("region", { name: /jornada 6/i });
      expect(card).toHaveTextContent(/sin acertantes/i);
      expect(card).toHaveTextContent(/1,25\s€/);
    });

    it("destaca el premio y los boletos propios", async () => {
      getQuinielaHistory.mockResolvedValue(
        history([
          item(7, {
            myHits: 14,
            myCategory: "Special",
            myPrize: 6.5,
            winners: [{ userName: "Carla Ruiz", category: "Special", hits: 14, prize: 6.5, ticketNumber: 1, isMine: true }],
          }),
        ]),
      );
      renderPage();

      const card = await screen.findByRole("region", { name: /jornada 7/i });
      expect(card).toHaveTextContent(/tu premio/i);
      expect(within(card).getByRole("listitem")).toHaveAttribute("data-mine", "true");
    });

    it("sin jornadas liquidadas muestra un estado vacío bajo la quiniela actual", async () => {
      renderPage();

      expect(await screen.findByText(/aún no hay quinielas liquidadas/i)).toBeInTheDocument();
      expect(screen.getByRole("region", { name: /quiniela actual/i })).toBeInTheDocument();
    });

    it("«Cargar más» pide la siguiente página y la añade", async () => {
      getQuinielaHistory
        .mockResolvedValueOnce(history([item(7)], 2))
        .mockResolvedValueOnce(history([item(6)], 2));
      renderPage();

      await screen.findByRole("region", { name: /jornada 7/i });
      fireEvent.click(screen.getByRole("button", { name: /cargar más/i }));

      expect(await screen.findByRole("region", { name: /jornada 6/i })).toBeInTheDocument();
      expect(getQuinielaHistory).toHaveBeenLastCalledWith("team-1", { limit: 10, offset: 1 });
      expect(screen.queryByRole("button", { name: /cargar más/i })).not.toBeInTheDocument();
    });
  });

  describe("errores", () => {
    it("si falla la carga muestra un error con «Reintentar» que vuelve a pedir los datos", async () => {
      getQuinielaHistory.mockRejectedValueOnce(new Error("boom")).mockResolvedValue(history([item(7)]));
      renderPage();

      fireEvent.click(await screen.findByRole("button", { name: /reintentar/i }));

      expect(await screen.findByRole("region", { name: /jornada 7/i })).toBeInTheDocument();
      await waitFor(() => expect(getQuinielaHistory).toHaveBeenCalledTimes(2));
    });
  });
});
