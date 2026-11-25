import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
const createLotteryBooks = vi.fn();
const assignLotteryBook = vi.fn();
const advanceLotteryBookStatus = vi.fn();
const undoLotteryBookStatus = vi.fn();
const deleteLotteryBook = vi.fn();
const updateLotteryBook = vi.fn();
vi.mock("../../../services/lotteryService", () => ({
  getLotteryCampaigns: (...args: unknown[]) => getLotteryCampaigns(...args),
  getLotteryCampaign: (...args: unknown[]) => getLotteryCampaign(...args),
  createLotteryCampaign: (...args: unknown[]) => createLotteryCampaign(...args),
  updateLotteryCampaign: vi.fn(),
  deleteLotteryCampaign: vi.fn(),
  createLotteryBooks: (...args: unknown[]) => createLotteryBooks(...args),
  assignLotteryBook: (...args: unknown[]) => assignLotteryBook(...args),
  updateLotteryBook: (...args: unknown[]) => updateLotteryBook(...args),
  deleteLotteryBook: (...args: unknown[]) => deleteLotteryBook(...args),
  advanceLotteryBookStatus: (...args: unknown[]) => advanceLotteryBookStatus(...args),
  undoLotteryBookStatus: (...args: unknown[]) => undoLotteryBookStatus(...args),
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
    status: "DeliveredToPlayer",
    deliveredOn: "2026-11-20",
    returnedOn: null,
    amountReturned: null,
    clubDeliveredOn: null,
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
    clubDelivery: { booksDelivered: 0, booksPending: 0, amountDelivered: 0, amountPending: 0, lastDeliveredOn: null },
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

const summaries = [{ id: "c1", name: "Lotería de Navidad 2026", drawDate: "2026-12-22" }];

function renderPage() {
  return render(
    <UserProvider>
      <MemoryRouter initialEntries={["/coach/lottery?teamId=team-1"]}>
        <Lottery />
      </MemoryRouter>
    </UserProvider>,
  );
}

async function showPlayerCard(filterName: RegExp, alias: string) {
  fireEvent.click(await screen.findByRole("button", { name: filterName }));
  return (await screen.findByText(alias)).closest("[data-testid='lottery-player-card']") as HTMLElement;
}

describe("Lottery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isPlayerRole = false;
    getLotteryCampaigns.mockResolvedValue(summaries);
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

  it("muestra el número de taco, su rango y su estado traducido en la tarjeta del jugador", async () => {
    getLotteryCampaign.mockResolvedValue(campaign([book({})]));
    renderPage();

    const card = await showPlayerCard(/entregado al jugador · 1/i, "Pablito");

    expect(within(card).getByText("Taco 12")).toBeInTheDocument();
    expect(within(card).getByText(/166–180/)).toBeInTheDocument();
    expect(within(card).getByText("Entregado al jugador")).toBeInTheDocument();
  });

  it("asigna un taco nuevo a un jugador con el número y las papeletas sugeridos", async () => {
    getLotteryCampaign.mockResolvedValue(
      campaign([book({}), book({ id: "b13", teamPlayerId: "p10", bookNumber: 13, firstTicketNumber: 181, lastTicketNumber: 195 })]),
    );
    assignLotteryBook.mockResolvedValue(campaign([book({})]));
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /asignar taco a leo/i }));
    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByLabelText("Nº de taco")).toHaveValue("14");
    expect(within(sheet).getByLabelText("Primera papeleta")).toHaveValue("196");
    expect(within(sheet).getByLabelText("Última papeleta")).toHaveValue("210");
    fireEvent.click(within(sheet).getByRole("button", { name: /^asignar taco$/i }));

    await waitFor(() =>
      expect(assignLotteryBook).toHaveBeenCalledWith("team-1", "c1", {
        teamPlayerId: "p11",
        bookNumber: 14,
        firstTicketNumber: 196,
        lastTicketNumber: 210,
      }),
    );
  });

  it("asigna un taco sin asignar ya creado al jugador elegido", async () => {
    const user = userEvent.setup();
    getLotteryCampaign.mockResolvedValue(
      campaign([book({ id: "b2", bookNumber: 2, firstTicketNumber: 16, lastTicketNumber: 30, status: "Unassigned", teamPlayerId: null, deliveredOn: null })]),
    );
    assignLotteryBook.mockResolvedValue(campaign([]));
    renderPage();

    await user.click(await screen.findByRole("button", { name: /asignar taco 2/i }));
    const sheet = await screen.findByRole("dialog");
    await user.click(within(sheet).getByRole("combobox", { name: /jugador/i }));
    await user.click(await screen.findByRole("option", { name: /leo/i }));
    await user.click(within(sheet).getByRole("button", { name: /^asignar taco$/i }));

    await waitFor(() =>
      expect(assignLotteryBook).toHaveBeenCalledWith("team-1", "c1", {
        bookId: "b2",
        teamPlayerId: "p11",
        bookNumber: 2,
        firstTicketNumber: 16,
        lastTicketNumber: 30,
      }),
    );
  });

  it("crea los tacos en bloque indicando cuántos", async () => {
    getLotteryCampaign.mockResolvedValue(campaign([]));
    createLotteryBooks.mockResolvedValue(campaign([]));
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /crear tacos/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/cuántos tacos/i), { target: { value: "20" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /^crear tacos$/i }));

    await waitFor(() => expect(createLotteryBooks).toHaveBeenCalledWith("team-1", "c1", { count: 20 }));
  });

  it("entrega al jugador un taco asignado pidiendo la fecha, hoy por defecto", async () => {
    getLotteryCampaign.mockResolvedValue(campaign([book({ status: "Assigned", deliveredOn: null })]));
    advanceLotteryBookStatus.mockResolvedValue(campaign([book({})]));
    renderPage();

    await showPlayerCard(/asignado · 1/i, "Pablito");
    fireEvent.click(screen.getByRole("button", { name: /entregar taco 12 al jugador/i }));
    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByLabelText(/fecha de entrega/i)).toHaveValue(todayIso());
    fireEvent.click(within(sheet).getByRole("button", { name: /^entregar al jugador$/i }));

    await waitFor(() => expect(advanceLotteryBookStatus).toHaveBeenCalledWith("team-1", "c1", "b12", { date: todayIso() }));
  });

  it("registra la devolución completa con un solo toque en «Todo vendido»", async () => {
    getLotteryCampaign.mockResolvedValue(campaign([book({})]));
    advanceLotteryBookStatus.mockResolvedValue(campaign([book({ status: "ReturnedToCoach", amountReturned: 75, returnedOn: todayIso(), ticketsSold: 15, ticketsUnsold: 0 })]));
    renderPage();

    await showPlayerCard(/entregado al jugador · 1/i, "Pablito");
    fireEvent.click(await screen.findByRole("button", { name: /devolver taco 12/i }));
    const sheet = await screen.findByRole("dialog");
    fireEvent.click(within(sheet).getByRole("button", { name: /todo vendido · 75 €/i }));

    await waitFor(() =>
      expect(advanceLotteryBookStatus).toHaveBeenCalledWith("team-1", "c1", "b12", { amount: 75, date: todayIso() }),
    );
  });

  it("limita el dinero de la devolución al tamaño del propio taco", async () => {
    getLotteryCampaign.mockResolvedValue(campaign([book({ firstTicketNumber: 1, lastTicketNumber: 10 })]));
    advanceLotteryBookStatus.mockResolvedValue(campaign([book({})]));
    renderPage();

    await showPlayerCard(/entregado al jugador · 1/i, "Pablito");
    fireEvent.click(await screen.findByRole("button", { name: /devolver taco 12/i }));
    const sheet = await screen.findByRole("dialog");
    fireEvent.click(within(sheet).getByRole("button", { name: /todo vendido · 50 €/i }));

    await waitFor(() =>
      expect(advanceLotteryBookStatus).toHaveBeenCalledWith("team-1", "c1", "b12", { amount: 50, date: todayIso() }),
    );
  });

  it("ajusta el dinero devuelto con los botones de ±precio y muestra las vendidas", async () => {
    getLotteryCampaign.mockResolvedValue(campaign([book({})]));
    advanceLotteryBookStatus.mockResolvedValue(campaign([book({})]));
    renderPage();

    await showPlayerCard(/entregado al jugador · 1/i, "Pablito");
    fireEvent.click(await screen.findByRole("button", { name: /devolver taco 12/i }));
    const sheet = await screen.findByRole("dialog");
    fireEvent.click(within(sheet).getByRole("button", { name: /restar 5 €/i }));
    fireEvent.click(within(sheet).getByRole("button", { name: /restar 5 €/i }));
    expect(within(sheet).getByText(/13 vendidas · 2 sobrantes/i)).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole("button", { name: /registrar devolución/i }));

    await waitFor(() =>
      expect(advanceLotteryBookStatus).toHaveBeenCalledWith("team-1", "c1", "b12", { amount: 65, date: todayIso() }),
    );
  });

  it("entrega al club un taco devuelto al entrenador pidiendo la fecha", async () => {
    getLotteryCampaign.mockResolvedValue(
      campaign([book({ status: "ReturnedToCoach", amountReturned: 75, returnedOn: "2026-12-01", ticketsSold: 15, ticketsUnsold: 0 })]),
    );
    advanceLotteryBookStatus.mockResolvedValue(campaign([book({})]));
    renderPage();

    await showPlayerCard(/devuelto al entrenador · 1/i, "Pablito");
    fireEvent.click(screen.getByRole("button", { name: /entregar taco 12 al club/i }));
    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByLabelText(/fecha de entrega al club/i)).toHaveValue(todayIso());
    fireEvent.click(within(sheet).getByRole("button", { name: /^entregar al club$/i }));

    await waitFor(() => expect(advanceLotteryBookStatus).toHaveBeenCalledWith("team-1", "c1", "b12", { date: todayIso() }));
  });

  it("deshace el último paso del taco tras confirmarlo en un diálogo", async () => {
    getLotteryCampaign.mockResolvedValue(campaign([book({})]));
    undoLotteryBookStatus.mockResolvedValue(campaign([book({ status: "Assigned", deliveredOn: null })]));
    renderPage();

    const card = await showPlayerCard(/entregado al jugador · 1/i, "Pablito");
    fireEvent.click(within(card).getByRole("button", { name: /más acciones de pablito/i }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /deshacer la entrega del taco 12/i }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/se quitará la fecha de entrega del taco 12 y volverá a «asignado»/i)).toBeInTheDocument();
    expect(undoLotteryBookStatus).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: /^deshacer$/i }));

    await waitFor(() => expect(undoLotteryBookStatus).toHaveBeenCalledWith("team-1", "c1", "b12"));
  });

  it("elimina un taco sin asignar tras confirmarlo", async () => {
    getLotteryCampaign.mockResolvedValue(
      campaign([book({ id: "b2", bookNumber: 2, status: "Unassigned", teamPlayerId: null, deliveredOn: null })]),
    );
    deleteLotteryBook.mockResolvedValue(campaign([]));
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /eliminar taco 2/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /^eliminar$/i }));

    await waitFor(() => expect(deleteLotteryBook).toHaveBeenCalledWith("team-1", "c1", "b2"));
  });

  it("la búsqueda encuentra al jugador por dorsal aunque esté en otro filtro", async () => {
    getLotteryCampaign.mockResolvedValue(campaign([book({})]));
    renderPage();

    await screen.findByText("Leo");
    expect(screen.queryByText("Pablito")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/buscar/i), { target: { value: "7" } });

    expect(await screen.findByText("Pablito")).toBeInTheDocument();
    expect(screen.queryByText("Leo")).not.toBeInTheDocument();
  });

  it("resume la entrega al club con los tacos entregados y los pendientes", async () => {
    getLotteryCampaign.mockResolvedValue(
      campaign([book({})], {
        clubDelivery: { booksDelivered: 3, booksPending: 2, amountDelivered: 225, amountPending: 150, lastDeliveredOn: "2026-12-10" },
      }),
    );
    renderPage();

    expect(await screen.findByText(/entregados 3 · 225 €/i)).toBeInTheDocument();
    expect(screen.getByText(/por entregar 2 · 150 €/i)).toBeInTheDocument();
  });

  it("en modo lectura solo muestra los tacos propios y ninguna acción", async () => {
    isPlayerRole = true;
    getLotteryCampaign.mockResolvedValue(campaign([book({})], { canEdit: false }));
    renderPage();

    expect(await screen.findByText("Pablito")).toBeInTheDocument();
    expect(screen.getByText("Taco 12")).toBeInTheDocument();
    expect(screen.queryByText("Leo")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /devolver taco/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /crear tacos/i })).not.toBeInTheDocument();
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
