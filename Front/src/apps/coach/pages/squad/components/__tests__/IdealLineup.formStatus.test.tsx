import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { DraggableListItem } from "../IdealLineup";
import type { SquadPlayer } from "../IdealLineup";

function renderItem(overrides: Partial<SquadPlayer>) {
  const player: SquadPlayer = { id: "p1", displayName: "Juan Pérez", readiness: 60, fatigue: 15, ...overrides };
  render(
    <MemoryRouter>
      <DraggableListItem player={player} />
    </MemoryRouter>,
  );
}

describe("IdealLineup - Estado de forma en el banquillo", () => {
  it("muestra en Ef el formStatus del backend cuando difiere del cálculo local", () => {
    renderItem({ formStatus: 33 });

    expect(screen.getByTestId("player-form-bar-ef")).toHaveTextContent("33%");
  });

  it("muestra un guion en Ef cuando el backend no tiene datos (formStatus null)", () => {
    renderItem({ formStatus: null });

    expect(screen.getByTestId("player-form-bar-ef")).toHaveTextContent("—");
  });

  it("cae al cálculo local de Ef cuando no hay formStatus", () => {
    renderItem({});

    // 60 * (1 - 15 / 200) = 55.5 → 56
    expect(screen.getByTestId("player-form-bar-ef")).toHaveTextContent("56%");
  });
});
