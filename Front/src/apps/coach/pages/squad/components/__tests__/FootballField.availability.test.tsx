import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DndContext } from "@dnd-kit/core";
import FootballField from "../FootballField";
import type { FormationSlotDef } from "../../../types/formation";

const slotDefs: FormationSlotDef[] = [{ slotIndex: 1, label: "GK", x: 12, y: 50 }];

describe("FootballField - letras Ef/R/C siempre visibles (sin depender de hover)", () => {
  it("muestra las letras Ef, R y C directamente en el DOM, sin depender de un tooltip", () => {
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
              readiness: 45,
              fatigue: 10,
            },
          }}
        />
      </DndContext>,
    );

    expect(screen.getByText("Ef")).toBeInTheDocument();
    expect(screen.getByText("R")).toBeInTheDocument();
    expect(screen.getByText("C")).toBeInTheDocument();
  });
});
