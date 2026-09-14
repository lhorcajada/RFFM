import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DndContext } from "@dnd-kit/core";
import { CompactBenchCard, DraggableCompactBenchCard } from "../CompactBenchCard";
import type { SquadPlayer } from "../../../../squad/components/IdealLineup";

function makePlayer(overrides: Partial<SquadPlayer> = {}): SquadPlayer {
  return {
    id: "p1",
    displayName: "Jugador Uno",
    dorsal: 7,
    position: "Centrocampista",
    competitiveness: 9,
    streakCount: 3,
    readiness: 40,
    fatigue: 10,
    ...overrides,
  };
}

describe("CompactBenchCard - tarjeta compacta de banquillo (mismo lenguaje visual que el campo)", () => {
  it("muestra foto/iniciales, dorsal y nombre, sin competitividad ni barras de forma", () => {
    render(<CompactBenchCard player={makePlayer()} minutesPlayed={0} isLeaving={false} />);

    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("Jugador Uno")).toBeInTheDocument();
    expect(screen.queryByText("9")).not.toBeInTheDocument(); // competitividad
    expect(screen.queryByTestId("player-form-bar-ef")).not.toBeInTheDocument();
    expect(screen.queryByText(/Comp\./)).not.toBeInTheDocument();
    expect(screen.queryByText(/⏱/)).not.toBeInTheDocument(); // racha
  });

  it("muestra la etiqueta de minutos solo cuando minutesPlayed es mayor que 0", () => {
    const { rerender } = render(
      <CompactBenchCard player={makePlayer()} minutesPlayed={23} isLeaving={false} />,
    );
    expect(screen.getByText("23'")).toBeInTheDocument();

    rerender(<CompactBenchCard player={makePlayer()} minutesPlayed={0} isLeaving={false} />);
    expect(screen.queryByText(/'$/)).not.toBeInTheDocument();
  });

  it("muestra el badge SALE cuando isLeaving es true", () => {
    render(<CompactBenchCard player={makePlayer()} minutesPlayed={10} isLeaving />);
    expect(screen.getByText("SALE")).toBeInTheDocument();
  });
});

describe("DraggableCompactBenchCard - mecanismo de arrastre", () => {
  it("envuelve la tarjeta compacta en un wrapper arrastrable con id sim-player-{id}", () => {
    render(
      <DndContext>
        <DraggableCompactBenchCard player={makePlayer()} minutesPlayed={0} isLeaving={false} />
      </DndContext>,
    );
    expect(screen.getByText("Jugador Uno")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });
});
