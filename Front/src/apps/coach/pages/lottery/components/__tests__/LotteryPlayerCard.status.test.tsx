import { fireEvent, render, screen } from "@testing-library/react";
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
  status: "DeliveredToPlayer",
  deliveredOn: "2026-11-03",
  returnedOn: null,
  amountReturned: null,
  clubDeliveredOn: null,
  ticketsSold: null,
  ticketsUnsold: null,
};

function renderCard(b: LotteryBook, canEdit = true) {
  const handlers = { onAssign: vi.fn(), onAdvance: vi.fn(), onEdit: vi.fn(), onUndo: vi.fn() };
  render(<LotteryPlayerCard player={player} books={[b]} canEdit={canEdit} {...handlers} />);
  return handlers;
}

describe("LotteryPlayerCard estado del taco", () => {
  it.each([
    ["Assigned", "Asignado"],
    ["DeliveredToPlayer", "Entregado al jugador"],
    ["ReturnedToCoach", "Devuelto al entrenador"],
    ["DeliveredToClub", "Entregado al club"],
  ] as const)("muestra el estado «%s» traducido al español", (status, label) => {
    renderCard({ ...book, status, deliveredOn: status === "Assigned" ? null : book.deliveredOn });
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});

describe("LotteryPlayerCard paso siguiente", () => {
  it("un taco asignado ofrece entregarlo al jugador", () => {
    const { onAdvance } = renderCard({ ...book, status: "Assigned", deliveredOn: null });
    fireEvent.click(screen.getByRole("button", { name: /entregar taco 3 al jugador/i }));
    expect(onAdvance).toHaveBeenCalledWith(expect.objectContaining({ id: "b1" }));
  });

  it("un taco entregado al jugador ofrece devolverlo", () => {
    const { onAdvance } = renderCard(book);
    fireEvent.click(screen.getByRole("button", { name: /devolver taco 3/i }));
    expect(onAdvance).toHaveBeenCalledWith(expect.objectContaining({ id: "b1" }));
  });

  it("un taco devuelto al entrenador ofrece entregarlo al club", () => {
    const { onAdvance } = renderCard({ ...book, status: "ReturnedToCoach", returnedOn: "2026-12-01", amountReturned: 210, ticketsSold: 42, ticketsUnsold: 8 });
    fireEvent.click(screen.getByRole("button", { name: /entregar taco 3 al club/i }));
    expect(onAdvance).toHaveBeenCalledWith(expect.objectContaining({ id: "b1" }));
  });

  it("un taco entregado al club no ofrece más pasos", () => {
    renderCard({ ...book, status: "DeliveredToClub", returnedOn: "2026-12-01", amountReturned: 210, clubDeliveredOn: "2026-12-10", ticketsSold: 42, ticketsUnsold: 8 });
    expect(screen.queryByRole("button", { name: /taco 3/i })).not.toBeInTheDocument();
  });

  it("sin permiso de edición no muestra ningún paso", () => {
    renderCard(book, false);
    expect(screen.queryByRole("button", { name: /devolver taco 3/i })).not.toBeInTheDocument();
  });
});

describe("LotteryPlayerCard menú", () => {
  const openMenu = () => fireEvent.click(screen.getByRole("button", { name: /más acciones de pablito/i }));

  it("deshace el último paso del taco", () => {
    const { onUndo } = renderCard(book);
    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: /deshacer la entrega del taco 3/i }));
    expect(onUndo).toHaveBeenCalledWith(expect.objectContaining({ id: "b1" }));
  });

  it("solo permite editar los números mientras el taco no está entregado al jugador", () => {
    const { onEdit } = renderCard({ ...book, status: "Assigned", deliveredOn: null });
    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: /editar taco 3/i }));
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: "b1" }));
  });

  it("no ofrece editar un taco ya entregado al jugador", () => {
    renderCard(book);
    openMenu();
    expect(screen.queryByRole("menuitem", { name: /editar taco 3/i })).not.toBeInTheDocument();
  });

  it("permite asignar otro taco al jugador", () => {
    const { onAssign } = renderCard(book);
    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: /asignar otro taco/i }));
    expect(onAssign).toHaveBeenCalledWith(expect.objectContaining({ id: "p7" }));
  });
});

describe("LotteryPlayerCard sin tacos", () => {
  it("ofrece asignar un taco al jugador", () => {
    const onAssign = vi.fn();
    render(
      <LotteryPlayerCard player={player} books={[]} canEdit onAssign={onAssign} onAdvance={vi.fn()} onEdit={vi.fn()} onUndo={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /asignar taco a pablito/i }));
    expect(onAssign).toHaveBeenCalledWith(expect.objectContaining({ id: "p7" }));
  });
});
