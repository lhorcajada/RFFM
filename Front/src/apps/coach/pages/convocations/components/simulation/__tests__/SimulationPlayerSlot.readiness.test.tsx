import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DndContext } from "@dnd-kit/core";
import SimulationPlayerSlot from "../SimulationPlayerSlot";

describe("SimulationPlayerSlot - indicador de rodaje en jugadores de campo", () => {
  it("muestra un punto de rodaje en el slot del jugador en el campo", () => {
    render(
      <DndContext>
        <SimulationPlayerSlot
          slotIndex={1}
          label="GK"
          x={12}
          y={50}
          prepareMode={false}
          player={{
            teamPlayerId: "p1",
            displayName: "Jugador Uno",
            dorsal: 7,
            readiness: 30,
          }}
        />
      </DndContext>,
    );

    expect(screen.getByTitle("Rodaje: 30%")).toBeInTheDocument();
  });

  it("no muestra el punto de rodaje cuando el jugador no tiene rodaje calculado", () => {
    render(
      <DndContext>
        <SimulationPlayerSlot
          slotIndex={1}
          label="GK"
          x={12}
          y={50}
          prepareMode={false}
          player={{
            teamPlayerId: "p1",
            displayName: "Jugador Uno",
            dorsal: 7,
            readiness: null,
          }}
        />
      </DndContext>,
    );

    expect(screen.queryByTitle(/Rodaje/)).not.toBeInTheDocument();
  });
});
