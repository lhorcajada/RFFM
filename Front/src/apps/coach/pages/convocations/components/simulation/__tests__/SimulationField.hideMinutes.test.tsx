import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DndContext } from "@dnd-kit/core";
import SimulationField from "../SimulationField";

const slotDefs = [{ slotIndex: 0, label: "POR", x: 10, y: 50 }];
const playersById = { p1: { teamPlayerId: "p1", displayName: "Jugador Uno" } };

describe("SimulationField - etiqueta de minutos", () => {
  it("muestra los minutos jugados de cada jugador de campo por defecto", () => {
    render(
      <DndContext>
        <SimulationField
          slotDefs={slotDefs}
          slots={{ 0: "p1" }}
          playersById={playersById}
          playerMinutes={{ p1: 12 }}
          prepareMode={false}
        />
      </DndContext>,
    );

    expect(screen.getByText("12'")).toBeInTheDocument();
  });

  it("oculta los minutos con hideMinutes (alineación previa al partido)", () => {
    render(
      <DndContext>
        <SimulationField
          slotDefs={slotDefs}
          slots={{ 0: "p1" }}
          playersById={playersById}
          playerMinutes={{}}
          prepareMode={false}
          hideMinutes
        />
      </DndContext>,
    );

    expect(screen.queryByText("0'")).not.toBeInTheDocument();
  });
});
