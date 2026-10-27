import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { LotteryBook } from "../../../../services/lotteryService";
import LotteryPlayerCard from "../LotteryPlayerCard";

const player = { id: "p7", name: "Pablo", lastName: "García", alias: "Pablito", dorsal: 7 };
const book: LotteryBook = {
  id: "b1",
  teamPlayerId: "p7",
  bookNumber: 3,
  firstTicketNumber: 201,
  lastTicketNumber: 250,
  deliveredOn: "2026-11-03",
  returnedOn: null,
  amountReturned: null,
  ticketsSold: null,
  ticketsUnsold: null,
};

const renderCard = (b: LotteryBook) =>
  render(
    <LotteryPlayerCard
      player={player}
      books={[b]}
      canEdit
      onDeliver={vi.fn()}
      onReturn={vi.fn()}
      onEdit={vi.fn()}
      onUndoReturn={vi.fn()}
      onDelete={vi.fn()}
    />,
  );

describe("LotteryPlayerCard estado del taco", () => {
  it("muestra la etiqueta «Por devolver» en un taco sin devolver", () => {
    renderCard(book);
    expect(screen.getByText("Por devolver")).toBeInTheDocument();
  });

  it("muestra la etiqueta «Devuelto» en un taco devuelto", () => {
    renderCard({ ...book, returnedOn: "2026-11-18", amountReturned: 210, ticketsSold: 42, ticketsUnsold: 8 });
    expect(screen.getByText("Devuelto")).toBeInTheDocument();
  });
});
