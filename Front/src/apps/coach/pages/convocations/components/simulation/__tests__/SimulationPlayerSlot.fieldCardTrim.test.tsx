import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DndContext } from "@dnd-kit/core";
import SimulationPlayerSlot from "../SimulationPlayerSlot";

const basePlayer = {
  teamPlayerId: "p1",
  displayName: "Jugador Uno",
  dorsal: 7,
  competitiveness: 9,
  readiness: 30,
  fatigue: 10,
};

describe("SimulationPlayerSlot - tarjeta de campo recortada (sin competitividad ni barras de forma)", () => {
  it("no muestra el badge de competitividad ni las barras de forma en modo preparación de cambio (DraggablePrepareCard)", () => {
    render(
      <DndContext>
        <SimulationPlayerSlot
          slotIndex={1}
          label="GK"
          x={12}
          y={50}
          prepareMode
          player={basePlayer}
        />
      </DndContext>,
    );

    expect(screen.queryByText("9")).not.toBeInTheDocument();
    expect(screen.queryByTestId("player-form-bar-ef")).not.toBeInTheDocument();
    expect(screen.queryByTestId("player-form-bar-r")).not.toBeInTheDocument();
    expect(screen.queryByTestId("player-form-bar-c")).not.toBeInTheDocument();
    // sigue mostrando lo esencial
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("Jugador Uno")).toBeInTheDocument();
  });

  it("no muestra el badge de competitividad ni las barras de forma con reposicionamiento libre (DraggableStaticCard)", () => {
    render(
      <DndContext>
        <SimulationPlayerSlot
          slotIndex={1}
          label="GK"
          x={12}
          y={50}
          prepareMode={false}
          freeRepositionEnabled
          player={basePlayer}
        />
      </DndContext>,
    );

    expect(screen.queryByText("9")).not.toBeInTheDocument();
    expect(screen.queryByTestId("player-form-bar-ef")).not.toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("no muestra el badge de competitividad ni las barras de forma en modo estático normal (StaticCard)", () => {
    render(
      <DndContext>
        <SimulationPlayerSlot
          slotIndex={1}
          label="GK"
          x={12}
          y={50}
          prepareMode={false}
          freeRepositionEnabled={false}
          player={basePlayer}
        />
      </DndContext>,
    );

    expect(screen.queryByText("9")).not.toBeInTheDocument();
    expect(screen.queryByTestId("player-form-bar-ef")).not.toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("conserva los badges funcionales (ENTRA, SALE, gol, Equipo N) tras el recorte", () => {
    render(
      <DndContext>
        <SimulationPlayerSlot
          slotIndex={1}
          label="GK"
          x={12}
          y={50}
          prepareMode
          entering
          hasGoals
          activeTab={0}
          usedTabById={{ p1: 1 }}
          player={basePlayer}
        />
      </DndContext>,
    );

    expect(screen.getByText("ENTRA")).toBeInTheDocument();
    expect(screen.getByText("⚽")).toBeInTheDocument();
    expect(screen.getByText("Equipo 2")).toBeInTheDocument();
  });
});
