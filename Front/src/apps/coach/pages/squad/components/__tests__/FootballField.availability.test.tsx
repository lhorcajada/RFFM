import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DndContext } from "@dnd-kit/core";
import FootballField from "../FootballField";
import type { FormationSlotDef } from "../../../types/formation";

const slotDefs: FormationSlotDef[] = [{ slotIndex: 1, label: "GK", x: 12, y: 50 }];

describe("FootballField - indicador de disponibilidad en jugadores de campo", () => {
  it("muestra un punto de disponibilidad en el slot del jugador en el campo", () => {
    render(
      <DndContext>
        <FootballField
          slotDefs={slotDefs}
          slots={{ 1: "p1" }}
          playersById={{
            p1: {
              teamPlayerId: "p1",
              displayName: "Jugador Uno",
              dorsal: 7,
              availability: 45,
            },
          }}
        />
      </DndContext>,
    );

    expect(screen.getByTitle("Disponibilidad: 45%")).toBeInTheDocument();
  });

  it("no muestra el punto de disponibilidad cuando el jugador no la tiene calculada", () => {
    render(
      <DndContext>
        <FootballField
          slotDefs={slotDefs}
          slots={{ 1: "p1" }}
          playersById={{
            p1: {
              teamPlayerId: "p1",
              displayName: "Jugador Uno",
              dorsal: 7,
              availability: null,
            },
          }}
        />
      </DndContext>,
    );

    expect(screen.queryByTitle(/Disponibilidad/)).not.toBeInTheDocument();
  });
});
