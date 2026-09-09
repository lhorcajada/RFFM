import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DndContext } from "@dnd-kit/core";
import FootballField from "../FootballField";
import type { FormationSlotDef } from "../../../types/formation";

const slotDefs: FormationSlotDef[] = [{ slotIndex: 1, label: "GK", x: 12, y: 50 }];

describe("FootballField - barras Ef/R/C en jugadores de campo", () => {
  it("muestra las barras compactas Ef/R/C, con letra siempre visible, sobre el jugador en el campo", () => {
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
              readiness: 72,
              fatigue: 20,
            },
          }}
        />
      </DndContext>,
    );

    // Ef = 72 * (1 - 20/200) = 64.8 -> 65% redondeado
    expect(screen.getByTestId("player-form-bar-ef")).toHaveTextContent("65%");
    expect(screen.getByTestId("player-form-bar-r")).toHaveTextContent("72%");
    expect(screen.getByTestId("player-form-bar-c")).toHaveTextContent("20%");
  });

  it("no muestra las barras cuando el jugador no tiene rodaje ni cansancio calculado", () => {
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
              readiness: null,
              fatigue: null,
            },
          }}
        />
      </DndContext>,
    );

    expect(screen.queryByTestId("player-form-bar-ef")).not.toBeInTheDocument();
  });
});
