import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { QuinielaMatch, QuinielaPaymentTicket } from "../../../services/quinielaService";
import TicketPicks from "../components/TicketPicks";

function match(overrides: Partial<QuinielaMatch>): QuinielaMatch {
  return {
    recordCode: "m1",
    homeTeam: "CD Los Olivos",
    awayTeam: "UD Sierra Norte",
    kickoffUtc: "2026-10-31T09:00:00Z",
    isValid: true,
    isPleno: false,
    homeGoals: null,
    awayGoals: null,
    isFinal: false,
    ...overrides,
  };
}

function ticket(overrides: Partial<QuinielaPaymentTicket> = {}): QuinielaPaymentTicket {
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
      { recordCode: "m3", sign: "2" },
    ],
    plenoHome: 2,
    plenoAway: 3,
    ...overrides,
  };
}

const matches: QuinielaMatch[] = [
  match({ recordCode: "m1" }),
  match({ recordCode: "m2", homeTeam: "Real Valdemar", awayTeam: "CD Las Encinas" }),
  match({ recordCode: "m3", homeTeam: "Unión Robledo", awayTeam: "CD Fresnedillas", isPleno: true }),
  match({ recordCode: "m4", homeTeam: "FC Cañada", awayTeam: "Racing Soto", isValid: false }),
];

function rowOf(text: string): HTMLElement {
  return screen.getByText(text).closest("[data-testid='ticket-pick']") as HTMLElement;
}

describe("TicketPicks", () => {
  it("muestra una fila por partido válido con el signo pronosticado", () => {
    render(<TicketPicks ticket={ticket()} matches={matches} />);

    expect(screen.getAllByTestId("ticket-pick")).toHaveLength(3);
    expect(within(rowOf("CD Los Olivos")).getByLabelText("Pronóstico: 1")).toBeInTheDocument();
    expect(within(rowOf("Real Valdemar")).getByLabelText("Pronóstico: X")).toBeInTheDocument();
    expect(within(rowOf("Unión Robledo")).getByLabelText("Pronóstico: 2")).toBeInTheDocument();
  });

  it("no muestra los partidos que no cuentan", () => {
    render(<TicketPicks ticket={ticket()} matches={matches} />);
    expect(screen.queryByText("FC Cañada")).not.toBeInTheDocument();
  });

  it("muestra los goles del Pleno con M para tres o más", () => {
    render(<TicketPicks ticket={ticket()} matches={matches} />);
    expect(screen.getByLabelText("Pleno al 15")).toHaveTextContent("2 - M");
  });

  it("marca acierto o fallo y el resultado cuando el partido ha terminado", () => {
    const finished = [
      match({ recordCode: "m1", homeGoals: 2, awayGoals: 0, isFinal: true }),
      match({ recordCode: "m2", homeTeam: "Real Valdemar", awayTeam: "CD Las Encinas", homeGoals: 1, awayGoals: 0, isFinal: true }),
      match({ recordCode: "m3", homeTeam: "Unión Robledo", awayTeam: "CD Fresnedillas", isPleno: true, homeGoals: 0, awayGoals: 4, isFinal: true }),
    ];
    render(<TicketPicks ticket={ticket()} matches={finished} />);

    expect(within(rowOf("CD Los Olivos")).getByText("2-0")).toBeInTheDocument();
    expect(within(rowOf("CD Los Olivos")).getByLabelText("Acierto")).toBeInTheDocument();
    expect(within(rowOf("Real Valdemar")).getByLabelText("Fallo")).toBeInTheDocument();
    expect(within(rowOf("Unión Robledo")).getByLabelText("Acierto")).toBeInTheDocument();
  });

  it("indica el acierto del Pleno solo si los goles coinciden", () => {
    const finished = [
      match({ recordCode: "m1" }),
      match({ recordCode: "m3", homeTeam: "Unión Robledo", awayTeam: "CD Fresnedillas", isPleno: true, homeGoals: 2, awayGoals: 5, isFinal: true }),
    ];
    render(<TicketPicks ticket={ticket()} matches={finished} />);

    expect(screen.getByLabelText("Pleno al 15")).toHaveTextContent("2 - M");
    expect(screen.getByLabelText("Pleno acertado")).toBeInTheDocument();
  });

  it("muestra un guion si el boleto no tiene pronóstico para un partido", () => {
    render(<TicketPicks ticket={ticket({ picks: [{ recordCode: "m1", sign: "1" }] })} matches={matches} />);
    expect(within(rowOf("Real Valdemar")).getByLabelText("Sin pronóstico")).toBeInTheDocument();
  });
});
