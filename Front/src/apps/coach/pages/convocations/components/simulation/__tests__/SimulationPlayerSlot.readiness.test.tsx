import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DndContext } from "@dnd-kit/core";
import SimulationPlayerSlot from "../SimulationPlayerSlot";

describe("SimulationPlayerSlot - barras Ef/R/C en jugadores de campo", () => {
  it("muestra las barras compactas Ef/R/C, con letra siempre visible, sobre el jugador del campo", () => {
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

    // Ef = 30 * (1 - 10/200) = 28.5 -> 29% redondeado
    expect(screen.getByTestId("player-form-bar-ef")).toHaveTextContent("29%");
    expect(screen.getByTestId("player-form-bar-r")).toHaveTextContent("30%");
    expect(screen.getByTestId("player-form-bar-c")).toHaveTextContent("10%");
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
