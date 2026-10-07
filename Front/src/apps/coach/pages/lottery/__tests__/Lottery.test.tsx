import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LotteryBook, LotteryCampaign } from "../../../services/lotteryService";
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
  default: () => ({ team: { id: "team-1", name: "Infantil A" }, teamTitleNode: null, clubSubtitleNode: null, loading: false }),
}));

const players = [
  { id: "p7", name: "Pablo", lastName: "García", alias: "Pablito", dorsal: 7 },
  { id: "p10", name: "Hugo", lastName: "Martín", alias: "Hugo", dorsal: 10 },
  { id: "p11", name: "Leo", lastName: "Ruiz", alias: "Leo", dorsal: 11 },
];
vi.mock("../../../hooks/useTeamRoster", () => ({
  useTeamRoster: () => ({ players, playersById: new Map(players.map((p) => [p.id, p])), loading: false }),
}));

let isPlayerRole = false;
vi.mock("../../../hooks/useIsPlayerRole", () => ({
  default: () => isPlayerRole,
  useIsPlayerRole: () => isPlayerRole,
}));

vi.mock("../../../../../shared/hooks/useAuditPageAccess", () => ({ useAuditPageAccess: vi.fn() }));

const getLotteryCampaigns = vi.fn();
const getLotteryCampaign = vi.fn();
const createLotteryCampaign = vi.fn();
const deliverLotteryBook = vi.fn();
const returnLotteryBook = vi.fn();
const recordLotteryClubDelivery = vi.fn();
vi.mock("../../../services/lotteryService", () => ({
  getLotteryCampaigns: (...args: unknown[]) => getLotteryCampaigns(...args),
  getLotteryCampaign: (...args: unknown[]) => getLotteryCampaign(...args),
  createLotteryCampaign: (...args: unknown[]) => createLotteryCampaign(...args),
  updateLotteryCampaign: vi.fn(),
  deleteLotteryCampaign: vi.fn(),
  deliverLotteryBook: (...args: unknown[]) => deliverLotteryBook(...args),
  updateLotteryBook: vi.fn(),
  deleteLotteryBook: vi.fn(),
  returnLotteryBook: (...args: unknown[]) => returnLotteryBook(...args),
  undoLotteryBookReturn: vi.fn(),
  recordLotteryClubDelivery: (...args: unknown[]) => recordLotteryClubDelivery(...args),
  undoLotteryClubDelivery: vi.fn(),
}));

import Lottery from "../Lottery";
import { todayIso } from "../lotteryHelpers";

function book(overrides: Partial<LotteryBook>): LotteryBook {
  return {
    id: "b12",
    teamPlayerId: "p7",
    bookNumber: 12,
    firstTicketNumber: 166,
    lastTicketNumber: 180,
    deliveredOn: "2026-11-20",
    returnedOn: null,
    amountReturned: null,
    ticketsSold: null,
    ticketsUnsold: null,
    ...overrides,
  };
}

function campaign(books: LotteryBook[], overrides: Partial<LotteryCampaign> = {}): LotteryCampaign {
  return {
    id: "c1",
    teamId: "team-1",
    name: "Lotería de Navidad 2026",
    drawDate: "2026-12-22",
    ticketPrice: 5,
    ticketsPerBook: 15,
    clubDeliveryFrom: "2026-12-09",
    clubDeliveryTo: "2026-12-15",
    clubDeliveredOn: null,
    clubDeliveredAmount: null,
    totals: {
      booksDelivered: books.length,
      booksReturned: 0,
      booksPending: books.length,
      ticketsDelivered: books.length * 15,
      ticketsSold: 0,
      ticketsUnsold: 0,
      ticketsPending: books.length * 15,
      amountCollected: 0,
      amountPending: books.length * 75,
    },
    books,
    canEdit: true,
    ...overrides,
  };
}

function renderPage() {
  return render(
    <UserProvider>
      <MemoryRouter initialEntries={["/coach/lottery?teamId=team-1"]}>
        <Lottery />
      </MemoryRouter>
    </UserProvider>,
  );
}

describe("Lottery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isPlayerRole = false;
  });

  it("sin campañas muestra el estado vacío y crea la campaña con los valores de Navidad", async () => {
    getLotteryCampaigns.mockResolvedValue([]);
    createLotteryCampaign.mockResolvedValue(campaign([]));
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /crear campaña/i }));
    const dialog = await screen.findByRole("dialog");
    const year = new Date().getFullYear();
    expect(within(dialog).getByLabelText(/nombre/i)).toHaveValue(`Lotería de Navidad ${year}`);
    fireEvent.click(within(dialog).getByRole("button", { name: /guardar/i }));

    await waitFor(() =>
      expect(createLotteryCampaign).toHaveBeenCalledWith("team-1", {
        name: `Lotería de Navidad ${year}`,
        drawDate: `${year}-12-22`,
        ticketPrice: 5,
        ticketsPerBook: 15,
        clubDeliveryFrom: `${year}-12-09`,
        clubDeliveryTo: `${year}-12-15`,
      }),
    );
  });

  it("muestra siempre el número de taco y su rango en la tarjeta del jugador", async () => {
    getLotteryCampaigns.mockResolvedValue([{ id: "c1", name: "Lotería de Navidad 2026", drawDate: "2026-12-22" }]);
    getLotteryCampaign.mockResolvedValue(campaign([book({}), book({ id: "b13", teamPlayerId: "p10", bookNumber: 13, firstTicketNumber: 181, lastTicketNumber: 195 })]));
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /por devolver/i }));

    const card = (await screen.findByText("Pablito")).closest("[data-testid='lottery-player-card']") as HTMLElement;
    expect(within(card).getByText("Taco 12")).toBeInTheDocument();
    expect(within(card).getByText(/166–180/)).toBeInTheDocument();
  });

  it("entrega un taco con el número, la primera papeleta y la fecha sugeridos", async () => {
    getLotteryCampaigns.mockResolvedValue([{ id: "c1", name: "Lotería de Navidad 2026", drawDate: "2026-12-22" }]);
    getLotteryCampaign.mockResolvedValue(campaign([book({}), book({ id: "b13", teamPlayerId: "p10", bookNumber: 13, firstTicketNumber: 181, lastTicketNumber: 195 })]));
    deliverLotteryBook.mockResolvedValue(campaign([book({})]));
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /entregar taco a leo/i }));
    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByText(/196–210/)).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole("button", { name: /^entregar taco$/i }));

    await waitFor(() =>
      expect(deliverLotteryBook).toHaveBeenCalledWith("team-1", "c1", {
        teamPlayerId: "p11",
        bookNumber: 14,
        firstTicketNumber: 196,
        deliveredOn: todayIso(),
      }),
    );
  });

  it("registra la devolución completa con un solo toque en «Todo vendido»", async () => {
    getLotteryCampaigns.mockResolvedValue([{ id: "c1", name: "Lotería de Navidad 2026", drawDate: "2026-12-22" }]);
    getLotteryCampaign.mockResolvedValue(campaign([book({})]));
    returnLotteryBook.mockResolvedValue(campaign([book({ amountReturned: 75, returnedOn: todayIso(), ticketsSold: 15, ticketsUnsold: 0 })]));
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /por devolver/i }));
    fireEvent.click(await screen.findByRole("button", { name: /devolver taco 12/i }));
    const sheet = await screen.findByRole("dialog");
    fireEvent.click(within(sheet).getByRole("button", { name: /todo vendido · 75 €/i }));

    await waitFor(() =>
      expect(returnLotteryBook).toHaveBeenCalledWith("team-1", "c1", "b12", { amount: 75, returnedOn: todayIso() }),
    );
  });

  it("ajusta el dinero devuelto con los botones de ±precio y muestra las vendidas", async () => {
    getLotteryCampaigns.mockResolvedValue([{ id: "c1", name: "Lotería de Navidad 2026", drawDate: "2026-12-22" }]);
    getLotteryCampaign.mockResolvedValue(campaign([book({})]));
    returnLotteryBook.mockResolvedValue(campaign([book({})]));
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /por devolver/i }));
    fireEvent.click(await screen.findByRole("button", { name: /devolver taco 12/i }));
    const sheet = await screen.findByRole("dialog");
    fireEvent.click(within(sheet).getByRole("button", { name: /restar 5 €/i }));
    fireEvent.click(within(sheet).getByRole("button", { name: /restar 5 €/i }));
    expect(within(sheet).getByText(/13 vendidas · 2 sobrantes/i)).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole("button", { name: /registrar devolución/i }));

    await waitFor(() =>
      expect(returnLotteryBook).toHaveBeenCalledWith("team-1", "c1", "b12", { amount: 65, returnedOn: todayIso() }),
    );
  });

  it("la búsqueda encuentra al jugador por dorsal aunque esté en otro filtro", async () => {
    getLotteryCampaigns.mockResolvedValue([{ id: "c1", name: "Lotería de Navidad 2026", drawDate: "2026-12-22" }]);
    getLotteryCampaign.mockResolvedValue(campaign([book({})]));
    renderPage();

    await screen.findByText("Leo");
    expect(screen.queryByText("Pablito")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/buscar/i), { target: { value: "7" } });

    expect(await screen.findByText("Pablito")).toBeInTheDocument();
    expect(screen.queryByText("Leo")).not.toBeInTheDocument();
  });

  it("registra la entrega al club con lo recogido como importe sugerido", async () => {
    getLotteryCampaigns.mockResolvedValue([{ id: "c1", name: "Lotería de Navidad 2026", drawDate: "2026-12-22" }]);
    const returned = book({ amountReturned: 75, returnedOn: "2026-12-01", ticketsSold: 15, ticketsUnsold: 0 });
    const withMoney = campaign([returned]);
    withMoney.totals = { ...withMoney.totals, booksReturned: 1, booksPending: 0, ticketsSold: 15, ticketsPending: 0, amountCollected: 75, amountPending: 0 };
    getLotteryCampaign.mockResolvedValue(withMoney);
    recordLotteryClubDelivery.mockResolvedValue(withMoney);
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /entregar al club/i }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText(/importe/i)).toHaveValue(75);
    fireEvent.click(within(dialog).getByRole("button", { name: /guardar/i }));

    await waitFor(() =>
      expect(recordLotteryClubDelivery).toHaveBeenCalledWith("team-1", "c1", { amount: 75, deliveredOn: todayIso() }),
    );
  });

  it("en modo lectura solo muestra los tacos propios y ninguna acción", async () => {
    isPlayerRole = true;
    getLotteryCampaigns.mockResolvedValue([{ id: "c1", name: "Lotería de Navidad 2026", drawDate: "2026-12-22" }]);
    getLotteryCampaign.mockResolvedValue(campaign([book({})], { canEdit: false }));
    renderPage();

    expect(await screen.findByText("Pablito")).toBeInTheDocument();
    expect(screen.getByText("Taco 12")).toBeInTheDocument();
    expect(screen.queryByText("Leo")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /devolver taco/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /entregar al club/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /más acciones/i })).not.toBeInTheDocument();
  });

  it("un jugador sin campañas no ve el botón de crear", async () => {
    isPlayerRole = true;
    getLotteryCampaigns.mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText(/no hay ninguna campaña/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /crear campaña/i })).not.toBeInTheDocument();
  });
});
