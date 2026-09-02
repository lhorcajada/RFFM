import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import CardsTimeline from "../CardsTimeline";
import type { CardEvent } from "../liveMatch.types";

function makeCard(overrides: Partial<CardEvent> = {}): CardEvent {
  return {
    id: "c1",
    minute: 30,
    half: 1,
    cardType: "yellow",
    teamPlayerId: "p1",
    playerName: "Jugador Uno",
    isRivalPlayer: false,
    rivalDorsal: null,
    ...overrides,
  };
}

describe("CardsTimeline", () => {
  it("renders minute, icon per cardType, and player name", () => {
    render(<CardsTimeline cards={[makeCard()]} onRemoveCard={vi.fn()} />);
    expect(screen.getByText(/30/)).toBeInTheDocument();
    expect(screen.getByText("Jugador Uno")).toBeInTheDocument();
  });

  it("renders 'Rival (#dorsal)' for rival cards", () => {
    render(
      <CardsTimeline
        cards={[makeCard({ teamPlayerId: null, playerName: null, isRivalPlayer: true, rivalDorsal: 4 })]}
        onRemoveCard={vi.fn()}
      />,
    );
    expect(screen.getByText(/Rival.*4/)).toBeInTheDocument();
  });

  it("hides the remove button when readOnly", () => {
    const { container } = render(
      <CardsTimeline cards={[makeCard()]} onRemoveCard={vi.fn()} readOnly />,
    );
    const btn = container.querySelector("button[title='Eliminar tarjeta']") as HTMLElement | null;
    expect(btn).toBeTruthy();
    expect(btn?.style.display).toBe("none");
  });
});
