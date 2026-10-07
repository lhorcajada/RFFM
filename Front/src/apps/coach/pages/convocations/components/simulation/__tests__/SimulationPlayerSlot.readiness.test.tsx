import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DndContext } from "@dnd-kit/core";
import SimulationPlayerSlot from "../SimulationPlayerSlot";

const slotCss = readFileSync(join(__dirname, "..", "SimulationPlayerSlot.module.css"), "utf-8");

describe("SimulationPlayerSlot - barras Ef/R/C bajo el avatar (solo desktop)", () => {
  it("muestra las barras compactas Ef/R/C del jugador de campo", () => {
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

    expect(screen.getByTestId("player-form-bar-ef")).toBeInTheDocument();
    expect(screen.getByTestId("player-form-bar-r")).toHaveTextContent("30%");
    expect(screen.getByTestId("player-form-bar-c")).toHaveTextContent("10%");
  });

  it("las barras van en un contenedor que solo se muestra en desktop", () => {
    render(
      <DndContext>
        <SimulationPlayerSlot
          slotIndex={1}
          label="GK"
          x={12}
          y={50}
          prepareMode={false}
          player={{ teamPlayerId: "p1", displayName: "Jugador Uno", readiness: 30, fatigue: 10 }}
        />
      </DndContext>,
    );

    expect(screen.getByTestId("player-form-bar-ef").closest("[class*='desktopFormBars']")).not.toBeNull();
    expect(slotCss).toMatch(/\.desktopFormBars\s*\{[^}]*display:\s*none/);
    expect(slotCss).toMatch(/@media \(min-width: 1024px\)\s*\{\s*\.desktopFormBars\s*\{[^}]*display:\s*flex/);
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
