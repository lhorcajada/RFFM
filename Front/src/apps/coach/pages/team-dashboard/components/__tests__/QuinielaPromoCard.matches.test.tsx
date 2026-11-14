import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COACH_FEATURE_ROUTES } from "../../../../constants/featureRoutes";
import type { QuinielaCurrent, QuinielaMatch, QuinielaTicket } from "../../../../services/quinielaService";

const mockPermissions = vi.fn();
vi.mock("../../../../../../shared/hooks/usePermissions", () => ({
  usePermissions: () => mockPermissions(),
}));

const getCurrentQuiniela = vi.fn();
vi.mock("../../../../services/quinielaService", () => ({
  getCurrentQuiniela: (...args: unknown[]) => getCurrentQuiniela(...args),
}));

import QuinielaPromoCard from "../QuinielaPromoCard";

const match = (over: Partial<QuinielaMatch>): QuinielaMatch => ({
  recordCode: "m1",
  homeTeam: "Local A",
  awayTeam: "Visitante A",
  kickoffUtc: "2026-11-14T09:00:00Z",
  isValid: true,
  isPleno: false,
  homeGoals: null,
  awayGoals: null,
  isFinal: false,
  ...over,
});

const ticket = (over: Partial<QuinielaTicket> = {}): QuinielaTicket => ({
  id: "t1",
  number: 1,
  picks: [],
  plenoHome: 0,
  plenoAway: 0,
  paymentStatus: "Paid",
  paymentDeadlineUtc: null,
  hits: null,
  category: null,
  prize: null,
  ...over,
});

function current(over: Partial<QuinielaCurrent> = {}): QuinielaCurrent {
  return {
    isOpen: true,
    jornada: {
      id: "j1",
      teamId: "team-1",
      rffmRoundId: "r7",
      roundNumber: 7,
      roundName: "Jornada 7",
      price: 1,
      status: "Open",
      carryIn: 0,
      firstKickoffUtc: "2026-11-14T09:00:00Z",
      paymentDeadlineUtc: null,
      picksClosed: true,
    },
    matches: [
      match({ recordCode: "a", homeTeam: "Getafe", awayTeam: "Leganés", isFinal: true, homeGoals: 2, awayGoals: 1 }),
      match({ recordCode: "b", homeTeam: "Fuenlabrada", awayTeam: "Alcorcón", isFinal: true, homeGoals: 0, awayGoals: 3 }),
      match({ recordCode: "c", homeTeam: "Parla", awayTeam: "Pinto", kickoffUtc: "2026-11-14T17:00:00Z" }),
    ],
    myTickets: [],
    pool: { participants: 3, paidTickets: 3, collected: 3, prizePool: 2, possiblePrizePool: 2 },
    previous: null,
    canManage: false,
    ...over,
  };
}

async function expand() {
  const toggle = await screen.findByRole("button", { name: /quiniela de la jornada/i });
  await userEvent.click(toggle);
}

function renderCard() {
  return render(
    <MemoryRouter>
      <QuinielaPromoCard teamId="team-1" />
    </MemoryRouter>,
  );
}

describe("QuinielaPromoCard — partidos y resultados", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-14T12:00:00Z"));
    mockPermissions.mockReturnValue({
      loading: false,
      hasFeatureAccess: (route: string) => route === COACH_FEATURE_ROUTES.Quiniela,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("lista los partidos con el resultado de los que han terminado", async () => {
    getCurrentQuiniela.mockResolvedValue(current());
    renderCard();
    await expand();

    const list = await screen.findByRole("list", { name: /partidos de la quiniela/i });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("Getafe");
    expect(items[0]).toHaveTextContent("2-1");
    expect(items[2]).toHaveTextContent("Parla");
    expect(items[2]).not.toHaveTextContent(/\d-\d/);
  });

  it("sin boleto, muestra los partidos pero ningún acierto ni fallo", async () => {
    getCurrentQuiniela.mockResolvedValue(current());
    renderCard();
    await expand();

    await screen.findByRole("list", { name: /partidos de la quiniela/i });
    expect(screen.queryByLabelText(/acierto|fallo/i)).not.toBeInTheDocument();
  });

  it("con boleto pagado indica en cada partido terminado si se ha acertado o no", async () => {
    getCurrentQuiniela.mockResolvedValue(
      current({
        myTickets: [
          ticket({
            picks: [
              { recordCode: "a", sign: "1" },
              { recordCode: "b", sign: "X" },
              { recordCode: "c", sign: "2" },
            ],
          }),
        ],
      }),
    );
    renderCard();
    await expand();

    const items = within(await screen.findByRole("list", { name: /partidos de la quiniela/i })).getAllByRole("listitem");
    expect(within(items[0]).getByLabelText(/acierto/i)).toBeInTheDocument();
    expect(within(items[1]).getByLabelText(/fallo/i)).toBeInTheDocument();
    expect(within(items[2]).queryByLabelText(/acierto|fallo/i)).not.toBeInTheDocument();
    expect(within(items[2]).getByText("2")).toBeInTheDocument();
  });

  it("resume los aciertos del boleto sobre los partidos ya jugados", async () => {
    getCurrentQuiniela.mockResolvedValue(
      current({
        myTickets: [
          ticket({
            picks: [
              { recordCode: "a", sign: "1" },
              { recordCode: "b", sign: "X" },
            ],
          }),
        ],
      }),
    );
    renderCard();
    await expand();

    expect(await screen.findByText(/1 acierto de 2 partidos jugados/i)).toBeInTheDocument();
  });

  it("con varios boletos pagados identifica cada pronóstico por su número", async () => {
    getCurrentQuiniela.mockResolvedValue(
      current({
        myTickets: [
          ticket({ id: "t1", number: 1, picks: [{ recordCode: "a", sign: "1" }] }),
          ticket({ id: "t2", number: 2, picks: [{ recordCode: "a", sign: "2" }] }),
        ],
      }),
    );
    renderCard();
    await expand();

    const first = within(await screen.findByRole("list", { name: /partidos de la quiniela/i })).getAllByRole("listitem")[0];
    expect(within(first).getByLabelText(/boleto 1.*acierto/i)).toBeInTheDocument();
    expect(within(first).getByLabelText(/boleto 2.*fallo/i)).toBeInTheDocument();
  });
});
