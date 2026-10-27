import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { LotteryTotals } from "../../../../services/lotteryService";
import LotterySummary from "../LotterySummary";

const totals: LotteryTotals = {
  booksDelivered: 12,
  booksReturned: 8,
  booksPending: 4,
  ticketsDelivered: 600,
  ticketsSold: 248,
  ticketsUnsold: 152,
  ticketsPending: 200,
  amountCollected: 1240,
  amountPending: 760,
};

describe("LotterySummary", () => {
  it("muestra el progreso de tacos devueltos en la barra", () => {
    render(<LotterySummary totals={totals} />);
    expect(screen.getByRole("progressbar", { name: /tacos devueltos/i })).toHaveAttribute("aria-valuenow", "67");
  });

  it("deja la barra a 0 cuando no hay tacos entregados", () => {
    render(<LotterySummary totals={{ ...totals, booksDelivered: 0, booksReturned: 0, booksPending: 0 }} />);
    expect(screen.getByRole("progressbar", { name: /tacos devueltos/i })).toHaveAttribute("aria-valuenow", "0");
  });

  it("muestra lo recogido y lo pendiente", () => {
    render(<LotterySummary totals={totals} />);
    expect(screen.getByText("Recogido")).toBeInTheDocument();
    expect(screen.getByText(/760.*pendiente/)).toBeInTheDocument();
  });
});
