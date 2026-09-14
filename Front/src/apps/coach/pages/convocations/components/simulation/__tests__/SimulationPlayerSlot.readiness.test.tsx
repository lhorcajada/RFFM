import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DndContext } from "@dnd-kit/core";
import SimulationPlayerSlot from "../SimulationPlayerSlot";

describe("SimulationPlayerSlot - barras Ef/R/C ya no se muestran en la tarjeta de campo", () => {
  it("no muestra las barras compactas Ef/R/C aunque el jugador tenga rodaje y cansancio calculados", () => {
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
            fatigue: 10,
          }}
        />
      </DndContext>,
    );

    expect(screen.queryByTestId("player-form-bar-ef")).not.toBeInTheDocument();
    expect(screen.queryByTestId("player-form-bar-r")).not.toBeInTheDocument();
    expect(screen.queryByTestId("player-form-bar-c")).not.toBeInTheDocument();
  });

  it("no muestra las barras cuando el jugador no tiene rodaje ni cansancio calculado", () => {
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
            fatigue: null,
          }}
        />
      </DndContext>,
    );

    expect(screen.queryByTestId("player-form-bar-ef")).not.toBeInTheDocument();
  });
});
